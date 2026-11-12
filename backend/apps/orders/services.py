import hashlib
import json
from datetime import timedelta
from decimal import ROUND_HALF_UP, Decimal, InvalidOperation

from django.conf import settings
from django.db import IntegrityError, transaction
from django.db.models import Q
from django.utils import timezone

from apps.audit import services as audit
from common.constants import MANAGERS, LocationType, OrderMode, OrderStatus, Role
from common.exceptions import DomainError

from .models import Order, OrderCounter, OrderItem, OrderStatusHistory
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
    OrderStatus.PREPARING: {OrderStatus.READY, OrderStatus.CANCELLED},
    OrderStatus.READY: {
        OrderStatus.SERVED,
        OrderStatus.OUT_FOR_DELIVERY,
        OrderStatus.CANCELLED,
    },
    OrderStatus.OUT_FOR_DELIVERY: {OrderStatus.SERVED},
    OrderStatus.SERVED: {OrderStatus.COMPLETED, OrderStatus.CANCELLED},
    OrderStatus.COMPLETED: set(),
    OrderStatus.CANCELLED: set(),
    OrderStatus.REJECTED: set(),
}

WAITER_VISIBLE_ORDER_STATUSES = (
    OrderStatus.RECEIVED,
    OrderStatus.CONFIRMED,
    OrderStatus.PREPARING,
    OrderStatus.READY,
    OrderStatus.OUT_FOR_DELIVERY,
    OrderStatus.SERVED,
)


def _fingerprint(data):
    payload = json.dumps(data, sort_keys=True, separators=(",", ":"), ensure_ascii=True)
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def _next_order_number():
    today = timezone.localdate()
    try:
        with transaction.atomic():
            counter, _ = OrderCounter.objects.select_for_update().get_or_create(
                date=today
            )
    except IntegrityError:
        counter = OrderCounter.objects.select_for_update().get(date=today)
    counter.last += 1
    counter.save(update_fields=["last"])
    return f"{today:%y%m%d}-{counter.last:04d}"


def waiter_orders(queryset, user):
    return queryset.filter(
        Q(created_by=user)
        | Q(
            status__in=WAITER_VISIBLE_ORDER_STATUSES,
            created_at__date=timezone.localdate(),
        )
    )


def waiter_can_access_order(order, user):
    if not user or not user.is_authenticated or not user.is_active:
        return False
    if order.created_by_id == user.pk:
        return True
    return (
        order.status in WAITER_VISIBLE_ORDER_STATUSES
        and timezone.localtime(order.created_at).date() == timezone.localdate()
    )


def _validate_order_location(mode, location):
    try:
        mode = OrderMode(mode)
    except (TypeError, ValueError):
        raise DomainError("invalid_mode", "Mode de commande invalide.", 400) from None
    expected_type = {
        OrderMode.DINE_IN: LocationType.TABLE,
        OrderMode.ROOM: LocationType.ROOM,
        OrderMode.TAKEAWAY: LocationType.TAKEAWAY,
    }[mode]
    required = mode in {OrderMode.DINE_IN, OrderMode.ROOM}
    if location is None:
        if required:
            raise DomainError(
                "invalid_location",
                "Un emplacement compatible avec le mode est requis.",
                400,
            )
        return mode
    if not location.is_active or location.type != expected_type:
        raise DomainError(
            "invalid_location",
            "L'emplacement ne correspond pas au mode de commande.",
            400,
        )
    return mode


def _calculate_tax(subtotal):
    try:
        tax_rate = Decimal(str(getattr(settings, "ORDER_TAX_RATE", "0")))
    except InvalidOperation:
        raise DomainError(
            "invalid_tax_rate", "Le taux de taxe serveur est invalide.", 500
        ) from None
    if not tax_rate.is_finite() or not Decimal(0) <= tax_rate <= Decimal(1):
        raise DomainError(
            "invalid_tax_rate", "Le taux de taxe serveur est invalide.", 500
        )
    return (subtotal * tax_rate).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


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
        "mode": str(data.get("mode", OrderMode.TAKEAWAY)),
        "location": str(getattr(data.get("location"), "pk", "") or ""),
    }
    if data.get("payment_method_expected"):
        fingerprint_data["payment_method_expected"] = data["payment_method_expected"]
    fingerprint = _fingerprint(fingerprint_data)
    mode = data.get("mode", OrderMode.TAKEAWAY)
    location = data.get("location")
    mode = _validate_order_location(mode, location)

    if idempotency_key:
        existing = Order.objects.filter(idempotency_key=idempotency_key).first()
        if existing:
            return _validate_idempotent_replay(existing, user, fingerprint), False

    resolved_items, subtotal = _resolve_items(items)
    tax = _calculate_tax(subtotal)
    total = subtotal + tax

    try:
        with transaction.atomic():
            order = Order.objects.create(
                number=_next_order_number(),
                idempotency_key=idempotency_key,
                idempotency_fingerprint=fingerprint,
                created_by=user,
                status=OrderStatus.RECEIVED,
                mode=mode,
                location=location,
                payment_method_expected=data.get("payment_method_expected", ""),
                source="STAFF",
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


def create_public_order(
    *,
    items,
    mode,
    location=None,
    note="",
    payment_method_expected="",
    idempotency_key=None,
):
    fingerprint = _public_order_fingerprint(
        items, mode, location, note, payment_method_expected
    )
    try:
        return _create_public_order(
            items=items,
            mode=mode,
            location=location,
            note=note,
            payment_method_expected=payment_method_expected,
            idempotency_key=idempotency_key,
        )
    except IntegrityError:
        if not idempotency_key:
            raise
        existing = Order.objects.filter(idempotency_key=idempotency_key).first()
        if (
            existing
            and existing.source == "PUBLIC"
            and existing.idempotency_fingerprint == fingerprint
        ):
            return existing, False
        if existing:
            raise DomainError(
                "idempotency_key_conflict",
                "Cette clé a déjà été utilisée avec une autre commande.",
                409,
            ) from None
        raise


@transaction.atomic
def cancel_public_order(*, order_id):
    from apps.core.models import RestaurantSettings

    try:
        order = Order.objects.select_for_update().get(pk=order_id)
    except Order.DoesNotExist:
        raise DomainError("order_not_found", "Commande introuvable.", 404) from None

    if order.source != "PUBLIC" or order.status != OrderStatus.RECEIVED:
        raise DomainError(
            "order_not_cancellable",
            "Cette commande ne peut plus être annulée par le client.",
            409,
        )
    settings = RestaurantSettings.load()
    deadline = order.created_at + timedelta(
        minutes=settings.withdrawal_delay_minutes
    )
    if timezone.now() > deadline:
        raise DomainError(
            "withdrawal_window_expired",
            "Le délai d'annulation de la commande est dépassé.",
            409,
        )

    return transition_order(
        order.pk,
        OrderStatus.CANCELLED,
        note="Annulation demandée par le client",
        internal=True,
    )


def _public_order_fingerprint(
    items, mode, location, note, payment_method_expected=""
):
    payload = {
        "items": [
            {
                "dish_id": str(item["dish_id"]),
                "quantity": item["quantity"],
                "notes": item.get("notes", ""),
            }
            for item in items
        ],
        "mode": str(mode),
        "location": str(location.pk) if location else None,
        "note": note[:300],
        "source": "PUBLIC",
    }
    if payment_method_expected:
        payload["payment_method_expected"] = payment_method_expected
    return _fingerprint(payload)


@transaction.atomic
def _create_public_order(
    *, items, mode, location, note, payment_method_expected, idempotency_key
):
    from apps.core.models import RestaurantSettings
    from apps.menu.models import Dish

    restaurant_settings = RestaurantSettings.load()
    if not restaurant_settings.public_ordering_enabled:
        raise DomainError(
            "ordering_disabled", "Les commandes en ligne sont fermées.", 503
        )

    if not items or len(items) > 30:
        raise DomainError("invalid_items", "Entre 1 et 30 lignes sont requises.", 400)
    mode = OrderMode(mode)
    expected_location = {
        OrderMode.DINE_IN: "TABLE",
        OrderMode.ROOM: "ROOM",
    }.get(mode)
    if expected_location and (
        location is None or location.type != expected_location or not location.is_active
    ):
        raise DomainError(
            "invalid_location", "Emplacement incompatible avec le mode.", 400
        )
    _validate_order_location(mode, location)

    fingerprint = _public_order_fingerprint(
        items, mode, location, note, payment_method_expected
    )
    if idempotency_key:
        existing = Order.objects.filter(idempotency_key=idempotency_key).first()
        if existing:
            if (
                existing.source != "PUBLIC"
                or existing.idempotency_fingerprint != fingerprint
            ):
                raise DomainError(
                    "idempotency_key_conflict",
                    "Cette clé a déjà été utilisée avec une autre commande.",
                    409,
                )
            return existing, False

    if (
        location
        and Order.objects.filter(
            location=location, status=OrderStatus.RECEIVED, source="PUBLIC"
        ).count()
        >= 3
    ):
        raise DomainError(
            "too_many_pending",
            "Une commande est déjà en attente pour cet emplacement.",
            429,
        )

    dish_ids = {str(item["dish_id"]) for item in items}
    dishes = {
        str(dish.pk): dish
        for dish in Dish.objects.filter(
            pk__in=dish_ids,
            is_published=True,
            is_available=True,
            category__is_active=True,
        ).select_related("category")
    }
    if len(dishes) != len(dish_ids):
        raise DomainError("dish_unavailable", "Un plat est indisponible.", 409)

    auto_confirm = restaurant_settings.auto_confirm_orders and mode != OrderMode.ROOM
    initial_status = OrderStatus.CONFIRMED if auto_confirm else OrderStatus.RECEIVED
    order = Order.objects.create(
        number=_next_order_number(),
        idempotency_key=idempotency_key,
        idempotency_fingerprint=fingerprint,
        mode=mode,
        location=location,
        payment_method_expected=payment_method_expected,
        source="PUBLIC",
        status=initial_status,
        notes=note[:300],
        subtotal=Decimal("0.00"),
        tax=Decimal("0.00"),
        discount=Decimal("0.00"),
        total=Decimal("0.00"),
    )
    lines = []
    subtotal = Decimal("0.00")
    for item in items:
        dish = dishes[str(item["dish_id"])]
        quantity = item["quantity"]
        line_total = dish.price * quantity
        subtotal += line_total
        lines.append(
            OrderItem(
                order=order,
                menu_item_id=str(dish.pk),
                menu_item_name=dish.name,
                quantity=quantity,
                unit_price=dish.price,
                total_price=line_total,
                special_instructions=item.get("notes", "")[:200],
            )
        )
    OrderItem.objects.bulk_create(lines)
    tax = _calculate_tax(subtotal)
    order.subtotal = subtotal
    order.tax = tax
    order.total = subtotal + tax
    order.save(update_fields=["subtotal", "tax", "total", "updated_at"])
    OrderStatusHistory.objects.create(
        order=order,
        from_status=None,
        to_status=initial_status,
        changed_by=None,
        note="Commande publique créée",
    )
    audit.log(
        actor=None,
        action="order.public_created",
        resource=order,
        metadata={"item_count": len(lines), "total": str(order.total)},
    )
    if initial_status == OrderStatus.CONFIRMED:
        _update_kitchen_queue(order, initial_status)
    _schedule_order_event(order, "order.created")
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
        raise DomainError(
            "invalid_status", "Statut de commande invalide.", 400
        ) from None

    with transaction.atomic():
        try:
            order = Order.objects.select_for_update().get(pk=order_id)
        except Order.DoesNotExist:
            raise DomainError("order_not_found", "Commande introuvable.", 404) from None

        if (
            not internal
            and getattr(actor, "role", None) == Role.WAITER
            and not waiter_can_access_order(order, actor)
        ):
            raise DomainError("permission_denied", "Commande non accessible.", 403)

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
        if (
            target_status in {OrderStatus.CANCELLED, OrderStatus.REJECTED}
            and not note.strip()
        ):
            raise DomainError("reason_required", "Un motif est obligatoire.", 400)

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
            metadata={"from": current, "to": target_status, "reason": note[:100]},
        )
        if target_status in {
            OrderStatus.CONFIRMED,
            OrderStatus.PREPARING,
            OrderStatus.READY,
            OrderStatus.SERVED,
        }:
            _update_kitchen_queue(order, target_status)
        settled = False
        if target_status == OrderStatus.SERVED:
            from apps.payments.services import settle_if_paid

            settled = settle_if_paid(order, actor=actor)
            if settled:
                order.refresh_from_db(fields=["status", "updated_at"])
        if not settled:
            _schedule_order_event(order, "order.status_changed")
        return order


@transaction.atomic
def change_order_location(*, order_id, location, actor):
    if not actor or not actor.is_authenticated or not actor.is_active:
        raise DomainError("authentication_required", "Authentification requise.", 401)
    if actor.role not in (MANAGERS | {Role.WAITER}):
        raise DomainError("permission_denied", "Rôle non autorisé.", 403)
    try:
        order = Order.objects.select_for_update().select_related("location").get(
            pk=order_id
        )
    except Order.DoesNotExist:
        raise DomainError("order_not_found", "Commande introuvable.", 404) from None

    if actor.role == Role.WAITER and not waiter_can_access_order(order, actor):
        raise DomainError("permission_denied", "Commande non accessible.", 403)
    if order.status not in {OrderStatus.RECEIVED, OrderStatus.CONFIRMED}:
        raise DomainError(
            "location_change_not_allowed",
            "L'emplacement ne peut plus être modifié après le début de la préparation.",
            409,
        )
    _validate_order_location(order.mode, location)
    if order.location_id == getattr(location, "pk", None):
        return order

    previous_location = order.location_id
    order.location = location
    order.save(update_fields=["location", "updated_at"])
    audit.log(
        actor=actor,
        action="order.location_changed",
        resource=order,
        metadata={
            "from_location_id": (
                str(previous_location) if previous_location is not None else None
            ),
            "to_location_id": (
                str(order.location_id) if order.location_id is not None else None
            ),
        },
    )
    return order


def _require_transition_role(actor, current, target):
    if not actor or not actor.is_authenticated or not actor.is_active:
        raise DomainError("authentication_required", "Authentification requise.", 401)
    role = getattr(actor, "role", None)
    if role in MANAGERS:
        return
    if role == Role.KITCHEN and (
        (current, target)
        in {
            (OrderStatus.CONFIRMED, OrderStatus.PREPARING),
            (OrderStatus.PREPARING, OrderStatus.READY),
        }
    ):
        return
    if role == Role.WAITER and (
        (current, target)
        in {
            (OrderStatus.RECEIVED, OrderStatus.CONFIRMED),
            (OrderStatus.RECEIVED, OrderStatus.CANCELLED),
            (OrderStatus.RECEIVED, OrderStatus.REJECTED),
            (OrderStatus.CONFIRMED, OrderStatus.CANCELLED),
            (OrderStatus.CONFIRMED, OrderStatus.REJECTED),
            (OrderStatus.READY, OrderStatus.SERVED),
            (OrderStatus.READY, OrderStatus.OUT_FOR_DELIVERY),
            (OrderStatus.OUT_FOR_DELIVERY, OrderStatus.SERVED),
        }
    ):
        return
    raise DomainError(
        "permission_denied", "Rôle non autorisé pour cette transition.", 403
    )


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
        OrderStatus.CONFIRMED: "CONFIRMED",
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
    location = order.location if order.location_id else None

    def publish():
        from apps.kitchen.services import publish_order_event

        publish_order_event(
            order_id,
            event_type,
            order.status,
            number=order.number,
            location_type=location.type if location else None,
            location_reference=location.reference if location else None,
        )

    transaction.on_commit(publish)
