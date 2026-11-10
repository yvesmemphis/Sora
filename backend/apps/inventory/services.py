from datetime import timedelta
from decimal import Decimal, InvalidOperation

from django.db import transaction
from django.db.models import F, Max, Q, Sum
from django.utils import timezone

from apps.audit import services as audit
from common.constants import MANAGERS, Role
from common.exceptions import DomainError

from .models import (
    Ingredient,
    InventoryAlert,
    RecipeConsumption,
    RecipeItem,
    RecipeVersion,
    StockLot,
    StockMovement,
)

ZERO = Decimal(0)
QUANTITY_PLACES = Decimal("0.001")
PRICE_PLACES = Decimal("0.01")


class InsufficientStock(DomainError):
    def __init__(self, ingredient, missing):
        super().__init__(
            "insufficient_stock",
            "Le stock disponible et non périmé est insuffisant.",
            409,
            details={"missing": str(missing)},
        )
        self.ingredient = ingredient
        self.missing = missing


def _decimal(value, field_name, quantum=QUANTITY_PLACES):
    try:
        amount = Decimal(value)
    except (InvalidOperation, TypeError, ValueError):
        raise DomainError("invalid_amount", f"{field_name} invalide.", 400) from None
    if not amount.is_finite():
        raise DomainError(
            "invalid_amount",
            f"{field_name} invalide.",
            400,
        )
    try:
        normalized = amount.quantize(quantum)
    except InvalidOperation:
        raise DomainError("invalid_amount", f"{field_name} invalide.", 400) from None
    if normalized != amount:
        raise DomainError(
            "invalid_amount",
            f"{field_name} a une précision supérieure à la précision autorisée.",
            400,
        )
    return amount


def _positive_quantity(value):
    quantity = _decimal(value, "La quantité")
    if quantity <= ZERO:
        raise DomainError("invalid_quantity", "La quantité doit être positive.", 400)
    return quantity


def _require_actor(actor, roles=MANAGERS):
    if not actor or not actor.is_authenticated or not actor.is_active:
        raise DomainError(
            "actor_required",
            "Un utilisateur authentifié est requis pour cette opération.",
            401,
        )
    if actor.role not in roles:
        raise DomainError("permission_denied", "Rôle non autorisé.", 403)


def _stock_quantity(ingredient):
    return (
        ingredient.stock_lots.filter(
            is_active=True,
            date_expiration__gte=timezone.localdate()
        ).aggregate(total=Sum("quantity_remaining"))["total"]
        or ZERO
    )


def _weighted_average_cost(ingredient):
    remaining = ingredient.stock_lots.filter(
        quantity_remaining__gt=ZERO,
        is_active=True,
        date_expiration__gte=timezone.localdate(),
    )
    totals = remaining.aggregate(
        quantity=Sum("quantity_remaining"),
        value=Sum(F("quantity_remaining") * F("cost_per_unit")),
    )
    if totals["quantity"]:
        return totals["value"] / totals["quantity"]

    last_lot = ingredient.stock_lots.order_by("-date_received", "-pk").first()
    return last_lot.cost_per_unit if last_lot else ingredient.cost_per_unit


def _update_ingredient_average_cost(ingredient):
    ingredient.cost_per_unit = _weighted_average_cost(ingredient).quantize(PRICE_PLACES)
    ingredient.save(update_fields=["cost_per_unit", "updated_at"])


def _resolve_alerts(ingredient, alert_type):
    now = timezone.now()
    InventoryAlert.objects.filter(
        ingredient=ingredient,
        alert_type=alert_type,
        is_resolved=False,
    ).update(is_resolved=True, resolved_at=now, updated_at=now)


def check_stock_alerts(ingredient, *, stock=None):
    if stock is None:
        stock = _stock_quantity(ingredient)
    active_alerts = []

    thresholds = (
        (InventoryAlert.Type.LOW_STOCK, ingredient.minimum_stock, stock < ingredient.minimum_stock),
        (
            InventoryAlert.Type.OVERSTOCK,
            ingredient.maximum_stock,
            ingredient.maximum_stock > ZERO and stock > ingredient.maximum_stock,
        ),
    )
    for alert_type, threshold, triggered in thresholds:
        if not triggered:
            _resolve_alerts(ingredient, alert_type)
            continue

        message = (
            f"Stock actuel : {stock}; seuil configuré : {threshold} "
            f"{ingredient.unit_of_measure}."
        )
        alert, created = InventoryAlert.objects.get_or_create(
            ingredient=ingredient,
            alert_type=alert_type,
            is_resolved=False,
            defaults={"message": message},
        )
        if not created and alert.message != message:
            alert.message = message
            alert.save(update_fields=["message", "updated_at"])
        active_alerts.append(alert)

    return active_alerts


@transaction.atomic
def receive_lot(
    ingredient,
    quantity,
    cost_per_unit,
    date_received,
    date_expiration,
    country_of_origin=None,
    supplier=None,
    actor=None,
):
    _require_actor(actor)
    quantity = _positive_quantity(quantity)
    unit_cost = _decimal(cost_per_unit, "Le coût unitaire", PRICE_PLACES)
    if unit_cost < ZERO:
        raise DomainError("invalid_cost", "Le coût unitaire ne peut pas être négatif.", 400)
    if date_expiration < date_received:
        raise DomainError(
            "invalid_expiry_date",
            "La date de péremption ne peut pas précéder la réception.",
            400,
        )

    locked_ingredient = Ingredient.objects.select_for_update().get(pk=ingredient.pk)
    if not locked_ingredient.is_active:
        raise DomainError("ingredient_inactive", "L'ingrédient est inactif.", 400)
    if supplier is not None and not supplier.is_active:
        raise DomainError("inactive_supplier", "Le fournisseur est inactif.", 400)

    lot = StockLot.objects.create(
        ingredient=locked_ingredient,
        supplier=supplier,
        quantity_received=quantity,
        quantity_remaining=quantity,
        date_received=date_received,
        date_expiration=date_expiration,
        cost_per_unit=unit_cost,
        country_of_origin=country_of_origin,
        created_by=actor,
    )
    StockMovement.objects.create(
        lot=lot,
        movement_type="IN",
        quantity=quantity,
        unit_cost=unit_cost,
        noted_by=actor,
        notes="Réception de lot",
    )

    _update_ingredient_average_cost(locked_ingredient)
    check_stock_alerts(locked_ingredient)
    audit.log(
        actor=actor,
        action="stock.receive",
        resource=lot,
        metadata={"ingredient": str(locked_ingredient.pk), "quantity": str(quantity)},
    )
    return lot


@transaction.atomic
def consume(*, ingredient, quantity, actor=None, order=None, reason=""):
    """Consomme les lots non périmés en FEFO, sans laisser de prélèvement partiel."""
    _require_actor(actor, MANAGERS | {Role.KITCHEN})
    remaining = _positive_quantity(quantity)
    locked_ingredient = Ingredient.objects.select_for_update().get(pk=ingredient.pk)
    if not locked_ingredient.is_active:
        raise DomainError("ingredient_inactive", "L'ingrédient est inactif.", 400)
    lots = (
        StockLot.objects.select_for_update()
        .filter(
            ingredient=locked_ingredient,
            is_active=True,
            quantity_remaining__gt=ZERO,
            date_expiration__gte=timezone.localdate(),
        )
        .order_by("date_expiration", "date_received", "pk")
    )

    movements = []
    for lot in lots:
        taken = min(lot.quantity_remaining, remaining)
        lot.quantity_remaining -= taken
        lot.save(update_fields=["quantity_remaining", "updated_at"])
        movements.append(
            StockMovement.objects.create(
                lot=lot,
                movement_type="OUT",
                quantity=taken,
                unit_cost=lot.cost_per_unit,
                reference_order=order,
                noted_by=actor,
                notes=reason[:200],
            )
        )
        remaining -= taken
        if remaining == ZERO:
            _update_ingredient_average_cost(locked_ingredient)
            check_stock_alerts(locked_ingredient)
            audit.log(
                actor=actor,
                action="stock.consume",
                resource=locked_ingredient,
                metadata={
                    "quantity": str(quantity),
                    "order_id": str(order.pk) if order else None,
                    "reason": reason[:200],
                },
            )
            return movements

    raise InsufficientStock(locked_ingredient, remaining)


@transaction.atomic
def adjust_lot(*, lot_id, counted_quantity, reason, actor=None):
    _require_actor(actor)
    if not reason.strip():
        raise DomainError("reason_required", "Un motif est obligatoire.", 400)

    counted = _decimal(counted_quantity, "La quantité comptée")
    if counted < ZERO:
        raise DomainError("invalid_adjustment", "La quantité comptée est invalide.", 400)

    lot = StockLot.objects.get(pk=lot_id)
    locked_ingredient = Ingredient.objects.select_for_update().get(pk=lot.ingredient_id)
    lot = StockLot.objects.select_for_update().get(pk=lot_id)
    if counted > lot.quantity_received:
        raise DomainError("invalid_adjustment", "La quantité dépasse la réception.", 400)

    delta = counted - lot.quantity_remaining
    lot.quantity_remaining = counted
    lot.save(update_fields=["quantity_remaining", "updated_at"])
    movement = None
    if delta:
        movement = StockMovement.objects.create(
            lot=lot,
            movement_type="ADJ",
            quantity=abs(delta),
            unit_cost=lot.cost_per_unit,
            noted_by=actor,
            notes=f"{reason.strip()[:170]} (variation {delta:+})",
        )
        audit.log(
            actor=actor,
            action="stock.adjust",
            resource=lot,
            metadata={"delta": str(delta), "reason": reason.strip()[:100]},
        )
    _update_ingredient_average_cost(locked_ingredient)
    check_stock_alerts(locked_ingredient)
    return lot, movement


@transaction.atomic
def declare_lot_waste(*, lot_id, quantity, reason, actor=None):
    _require_actor(actor)
    if not reason.strip():
        raise DomainError("reason_required", "Un motif est obligatoire.", 400)
    amount = _positive_quantity(quantity)

    lot = StockLot.objects.get(pk=lot_id)
    locked_ingredient = Ingredient.objects.select_for_update().get(pk=lot.ingredient_id)
    lot = StockLot.objects.select_for_update().get(pk=lot_id)
    if amount > lot.quantity_remaining:
        raise DomainError(
            "invalid_waste",
            "La quantité déclarée dépasse le stock restant du lot.",
            400,
        )

    lot.quantity_remaining -= amount
    lot.save(update_fields=["quantity_remaining", "updated_at"])
    movement = StockMovement.objects.create(
        lot=lot,
        movement_type="WST",
        quantity=amount,
        unit_cost=lot.cost_per_unit,
        noted_by=actor,
        notes=reason.strip()[:200],
    )
    audit.log(
        actor=actor,
        action="stock.waste",
        resource=lot,
        metadata={"quantity": str(amount), "reason": reason.strip()[:100]},
    )
    _update_ingredient_average_cost(locked_ingredient)
    check_stock_alerts(locked_ingredient)
    return movement


def average_unit_cost(ingredient):
    """Retourne le coût moyen pondéré du stock restant, ou le dernier coût connu."""
    return _weighted_average_cost(ingredient)


@transaction.atomic
def publish_recipe_version(*, menu_item_id, name, items, actor, notes=""):
    _require_actor(actor)
    if not menu_item_id or not name.strip() or not items:
        raise DomainError(
            "invalid_recipe",
            "Une recette doit avoir un plat, un nom et au moins un ingrédient.",
            400,
        )

    active_recipes = RecipeVersion.objects.select_for_update().filter(
        menu_item_id=str(menu_item_id),
        is_active=True,
    )
    active_recipes.update(
        is_active=False,
        valid_until=timezone.now(),
        updated_at=timezone.now(),
    )
    version_number = (
        RecipeVersion.objects.filter(menu_item_id=str(menu_item_id))
        .aggregate(max_version=Max("version_number"))["max_version"]
        or 0
    ) + 1
    valid_from = timezone.now()
    recipe = RecipeVersion.objects.create(
        menu_item_id=str(menu_item_id),
        name=name.strip(),
        version_number=version_number,
        is_active=True,
        valid_from=valid_from,
        notes=notes.strip(),
        created_by=actor,
    )
    recipe_items = []
    for item in items:
        ingredient = item["ingredient"]
        quantity = _decimal(
            item["quantity_required"], "La quantité de recette", QUANTITY_PLACES
        )
        if quantity <= ZERO or not ingredient.is_active:
            raise DomainError(
                "invalid_recipe_item",
                "La quantité doit être positive et l'ingrédient actif.",
                400,
            )
        recipe_items.append(
            RecipeItem(
                recipe_version=recipe,
                ingredient=ingredient,
                quantity_required=quantity,
                is_required=item.get("is_required", True),
                created_by=actor,
            )
        )
    RecipeItem.objects.bulk_create(recipe_items)
    audit.log(
        actor=actor,
        action="inventory.recipe_published",
        resource=recipe,
        metadata={
            "menu_item_id": str(menu_item_id),
            "version": version_number,
            "item_count": len(recipe_items),
        },
    )
    return recipe


@transaction.atomic
def consume_for_order(order, *, actor):
    from apps.orders.models import Order as OrderModel

    _require_actor(actor, MANAGERS | {Role.KITCHEN})
    locked_order = OrderModel.objects.select_for_update().get(pk=order.pk)
    if RecipeConsumption.objects.filter(order=locked_order).exists():
        return []

    ordered_quantities = {}
    items = locked_order.items.all()
    for order_item in items:
        current = ordered_quantities.get(order_item.menu_item_id, 0)
        ordered_quantities[order_item.menu_item_id] = current + order_item.quantity

    consumptions = []
    for menu_item_id, order_quantity in ordered_quantities.items():
        recipe = (
            RecipeVersion.objects.filter(
                menu_item_id=menu_item_id,
                valid_from__lte=locked_order.created_at,
            )
            .filter(
                Q(valid_until__isnull=True)
                | Q(valid_until__gt=locked_order.created_at)
            )
            .order_by("-version_number")
            .first()
        )
        if recipe is None:
            audit.log(
                actor=actor,
                action="inventory.recipe_missing",
                resource=locked_order,
                metadata={"menu_item_id": menu_item_id},
            )
            continue

        for recipe_item in recipe.items.select_related("ingredient").all():
            amount = (
                recipe_item.quantity_required * order_quantity
            ).quantize(QUANTITY_PLACES)
            consume(
                ingredient=recipe_item.ingredient,
                quantity=amount,
                actor=actor,
                order=locked_order,
                reason=f"Consommation recette {recipe.name} v{recipe.version_number}",
            )
            remaining_stock = _stock_quantity(recipe_item.ingredient)
            consumptions.append(
                RecipeConsumption.objects.create(
                    recipe_version=recipe,
                    recipe_item=recipe_item,
                    order=locked_order,
                    quantity_consumed_per_item=amount,
                    stock_remaining_after=remaining_stock,
                    created_by=actor,
                )
            )

    return consumptions


def check_all_stock_alerts(*, expiry_days=7):
    if expiry_days < 0:
        raise DomainError(
            "invalid_expiry_days", "Le délai d'alerte ne peut pas être négatif.", 400
        )

    active_ingredients = list(Ingredient.objects.filter(is_active=True).only("id"))
    stock_by_ingredient = {
        row["ingredient_id"]: row["total"] or ZERO
        for row in StockLot.objects.filter(
            ingredient__is_active=True,
            is_active=True,
            date_expiration__gte=timezone.localdate(),
        )
        .values("ingredient_id")
        .annotate(total=Sum("quantity_remaining"))
    }
    alerts = []
    for ingredient in active_ingredients:
        alerts.extend(
            check_stock_alerts(
                ingredient,
                stock=stock_by_ingredient.get(ingredient.pk, ZERO),
            )
        )

    expiry_date = timezone.localdate() + timedelta(days=expiry_days)
    expiring_lots = StockLot.objects.filter(
        ingredient__is_active=True,
        is_active=True,
        quantity_remaining__gt=ZERO,
        date_expiration__lte=expiry_date,
    ).select_related("ingredient")
    expiring_lots = list(expiring_lots)
    expiring_ids = {lot.pk for lot in expiring_lots}
    existing_alerts = {
        alert.stock_lot_id: alert
        for alert in InventoryAlert.objects.filter(
            stock_lot_id__in=expiring_ids,
            alert_type=InventoryAlert.Type.EXPIRING,
            is_resolved=False,
        )
    }
    new_alerts = []
    current_alerts = []
    for lot in expiring_lots:
        if lot.date_expiration < timezone.localdate():
            message = f"Lot périmé depuis le {lot.date_expiration}."
        else:
            message = f"Lot à péremption proche : {lot.date_expiration}."
        alert = existing_alerts.get(lot.pk)
        if alert is None:
            alert = InventoryAlert(
                stock_lot=lot,
                ingredient=lot.ingredient,
                alert_type=InventoryAlert.Type.EXPIRING,
                message=message,
            )
            new_alerts.append(alert)
        elif alert.message != message:
            alert.message = message
            alert.save(update_fields=["message", "updated_at"])
        current_alerts.append(alert)

    if new_alerts:
        InventoryAlert.objects.bulk_create(new_alerts)
        current_alerts.extend(new_alerts)

    stale_alerts = InventoryAlert.objects.filter(
        alert_type=InventoryAlert.Type.EXPIRING,
        is_resolved=False,
    )
    if expiring_ids:
        stale_alerts = stale_alerts.exclude(stock_lot_id__in=expiring_ids)
    now = timezone.now()
    stale_alerts.update(is_resolved=True, resolved_at=now, updated_at=now)
    return alerts + current_alerts
