import hashlib
import json
from decimal import ROUND_HALF_UP, Decimal, InvalidOperation

from django.conf import settings
from django.db import IntegrityError, transaction

from apps.audit import services as audit
from common.constants import MANAGERS, OrderStatus, Role
from common.exceptions import DomainError

from .models import Order, OrderItem, OrderStatusHistory
from .pricing import get_menu_item

ALLOWED_TRANSITIONS = {
    OrderStatus.RECEIVED: {
        OrderStatus.CONFIRMED,
        OrderStatus.CANCELLED,
        OrderStatus.REJECTED,
    },
    OrderStatus.CONFIRMED: {
        OrderStatus.PREPARING,
        OrderStatus.CANCELLED,
        OrderStatus.REJECTED,
    },
    OrderStatus.PREPARING: {OrderStatus.READY},
    OrderStatus.READY: {OrderStatus.SERVED},
    OrderStatus.SERVED: {OrderStatus.COMPLETED, OrderStatus.CANCELLED},
    OrderStatus.COMPLETED: set(),
    OrderStatus.CANCELLED: set(),
    OrderStatus.REJECTED: set(),
}


def _fingerprint(data):
    payload = json.dumps(data, sort_keys=True, separators=(",", ":"), ensure_ascii=True)
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def _resolve_items(items):
    resolved = []
    subtotal = Decimal("0.00")
    for item_data in items:
        menu_item_id = str(item_data["menu_item_id"])
        quantity = int(item_data["quantity"])
        if quantity < 1:
            raise DomainError(
                "invalid_quantity", "La quantité doit être supérieure à zéro.", 400
            )

        menu_item = get_menu_item(menu_item_id)
        if not menu_item or not getattr(menu_item, "is_active", True):
            raise DomainError("menu_item_unavailable", "Article indisponible.", 400)
        try:
            unit_price = Decimal(str(menu_item.price)).quantize(Decimal("0.01"))
        except (AttributeError, InvalidOperation, TypeError, ValueError):
            raise DomainError(
                "invalid_menu_price", "Le prix serveur de l'article est invalide.", 500
            ) from None
        if unit_price < 0:
            raise DomainError(
                "invalid_menu_price", "Le prix serveur ne peut pas être négatif.", 500
            )

        line_total = unit_price * quantity
        subtotal += line_total
        resolved.append(
            {
                "menu_item_id": menu_item_id,
                "menu_item_name": str(menu_item.name),
                "quantity": quantity,
                "unit_price": unit_price,
                "total_price": line_total,
                "special_instructions": item_data.get("special_instructions", ""),
            }
        )
    return resolved, subtotal.quantize(Decimal("0.01"))


def create_order(data, *, user, idempotency_key=None):
    if not user or not user.is_authenticated or not user.is_active:
        raise DomainError("authentication_required", "Authentification requise.", 401)
    if user.role not in (MANAGERS | {Role.WAITER}):
        raise DomainError("permission_denied", "Rôle non autorisé.", 403)
    items = data.get("items")
    if not isinstance(items, list) or not items:
        raise DomainError(
            "empty_order", "Une commande doit contenir au moins un article.", 400
        )

    fingerprint_data = {
        "items": items,
        "table_number": data.get("table_number"),
        "customer_name": data.get("customer_name"),
        "customer_phone": data.get("customer_phone"),
        "notes": data.get("notes"),
    }
    fingerprint = _fingerprint(fingerprint_data)

    if idempotency_key:
        existing = Order.objects.filter(idempotency_key=idempotency_key).first()
        if existing:
            return _validate_idempotent_replay(existing, user, fingerprint), False

    resolved_items, subtotal = _resolve_items(items)
    try:
        tax_rate = Decimal(str(getattr(settings, "ORDER_TAX_RATE", "0")))
    except InvalidOperation:
        raise DomainError("invalid_tax_rate", "Le taux de taxe serveur est invalide.", 500) from None
    if not tax_rate.is_finite() or not Decimal(0) <= tax_rate <= Decimal(1):
        raise DomainError("invalid_tax_rate", "Le taux de taxe serveur est invalide.", 500)
    tax = (subtotal * tax_rate).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    total = subtotal + tax

    try:
        with transaction.atomic():
            order = Order.objects.create(
                idempotency_key=idempotency_key,
                idempotency_fingerprint=fingerprint,
                created_by=user,
                status=OrderStatus.RECEIVED,
                table_number=data.get("table_number"),
                customer_name=data.get("customer_name"),
                customer_phone=data.get("customer_phone"),
                notes=data.get("notes"),
                subtotal=subtotal,
                tax=tax,
                discount=Decimal("0.00"),
                total=total,
            )
            OrderItem.objects.bulk_create(
                [OrderItem(order=order, **item) for item in resolved_items]
            )
            OrderStatusHistory.objects.create(
                order=order,
                from_status=None,
                to_status=OrderStatus.RECEIVED,
                changed_by=user,
                note="Commande créée",
            )
            audit.log(
                actor=user,
                action="order.created",
                resource=order,
                metadata={"item_count": len(resolved_items), "total": str(total)},
            )
            _schedule_order_event(order, "order.created")
    except IntegrityError:
        if not idempotency_key:
            raise
        existing = Order.objects.filter(idempotency_key=idempotency_key).first()
        if existing is None:
            raise
        return _validate_idempotent_replay(existing, user, fingerprint), False
    return order, True


def _validate_idempotent_replay(order, user, fingerprint):
    if order.created_by_id != user.pk:
        raise DomainError(
            "idempotency_key_conflict",
            "Cette clé d'idempotence appartient à une autre commande.",
            409,
        )
    if order.idempotency_fingerprint != fingerprint:
        raise DomainError(
            "idempotency_key_conflict",
            "Cette clé d'idempotence a déjà été utilisée avec un autre contenu.",
            409,
        )
    return order


def transition_order(order_id, target_status, *, actor=None, note="", internal=False):
    try:
        target_status = OrderStatus(target_status)
    except ValueError:
        raise DomainError("invalid_status", "Statut de commande invalide.", 400) from None

    with transaction.atomic():
        try:
            order = Order.objects.select_for_update().get(pk=order_id)
        except Order.DoesNotExist:
            raise DomainError("order_not_found", "Commande introuvable.", 404) from None

        current = order.status
        allowed = ALLOWED_TRANSITIONS.get(current, set())
        if target_status not in allowed:
            raise DomainError(
                "invalid_transition",
                f"Transition interdite : {current} -> {target_status}.",
                409,
                details={"current_status": current, "allowed": sorted(allowed)},
            )
        if not internal:
            _require_transition_role(actor, current, target_status)

        if current == OrderStatus.CONFIRMED and target_status == OrderStatus.PREPARING:
            _consume_order_stock(order, actor)

        order.status = target_status
        order.save(update_fields=["status", "updated_at"])
        OrderStatusHistory.objects.create(
            order=order,
            from_status=current,
            to_status=target_status,
            changed_by=actor,
            note=note[:500] or "Transition de statut",
        )
        audit.log(
            actor=actor,
            action="order.status_changed",
            resource=order,
            metadata={"from": current, "to": target_status},
        )
        if target_status in {OrderStatus.PREPARING, OrderStatus.READY, OrderStatus.SERVED}:
            _update_kitchen_queue(order, target_status)
        _schedule_order_event(order, "order.status_changed")
        return order


def _require_transition_role(actor, current, target):
    if not actor or not actor.is_authenticated or not actor.is_active:
        raise DomainError("authentication_required", "Authentification requise.", 401)
    role = getattr(actor, "role", None)
    if role in MANAGERS:
        return
    if role == Role.KITCHEN and (
        (current, target) in {
            (OrderStatus.CONFIRMED, OrderStatus.PREPARING),
            (OrderStatus.PREPARING, OrderStatus.READY),
        }
    ):
        return
    if role == Role.WAITER and (
        (current, target) in {
            (OrderStatus.RECEIVED, OrderStatus.CONFIRMED),
            (OrderStatus.READY, OrderStatus.SERVED),
            (OrderStatus.RECEIVED, OrderStatus.CANCELLED),
            (OrderStatus.CONFIRMED, OrderStatus.CANCELLED),
        }
    ):
        return
    raise DomainError("permission_denied", "Rôle non autorisé pour cette transition.", 403)


def _consume_order_stock(order, actor):
    from apps.inventory.models import InventoryAlert
    from apps.inventory.services import check_stock_alerts, consume_for_order

    try:
        consume_for_order(order, actor=actor)
    except DomainError as exc:
        if exc.code != "insufficient_stock":
            raise
        ingredient = getattr(exc, "ingredient", None)
        if ingredient is not None:
            check_stock_alerts(ingredient)
            InventoryAlert.objects.get_or_create(
                ingredient=ingredient,
                alert_type=InventoryAlert.Type.LOW_STOCK,
                is_resolved=False,
                defaults={
                    "message": f"Rupture de stock lors de la préparation de la commande {order.pk}."
                },
            )
        audit.log(
            actor=actor,
            action="order.stock_shortage",
            resource=order,
            metadata={"code": exc.code, "details": exc.details},
        )


def _update_kitchen_queue(order, target_status):
    from apps.kitchen.models import KitchenQueueItem

    queue_status = {
        OrderStatus.PREPARING: "PREPARING",
        OrderStatus.READY: "READY",
        OrderStatus.SERVED: "SERVED",
    }[target_status]
    KitchenQueueItem.objects.update_or_create(
        order=order,
        defaults={"status": queue_status},
    )


def _schedule_order_event(order, event_type):
    order_id = str(order.pk)

    def publish():
        from apps.kitchen.services import publish_order_event

        publish_order_event(order_id, event_type, order.status)

    transaction.on_commit(publish)
