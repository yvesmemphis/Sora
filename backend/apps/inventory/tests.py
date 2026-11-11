from concurrent.futures import ThreadPoolExecutor
from datetime import date, timedelta
from decimal import Decimal
from io import StringIO
from threading import Barrier

import pytest
from django.core.management import call_command
from django.db import IntegrityError, close_old_connections, connection, transaction
from django.db.models import Sum
from rest_framework.test import APIClient

from apps.accounts.factories import UserFactory
from apps.audit.models import AuditEvent
from apps.orders.models import Order, OrderItem
from common.constants import Role

from .models import (
    Ingredient,
    InventoryAlert,
    RecipeConsumption,
    StockLot,
    StockMovement,
)
from .services import (
    InsufficientStock,
    adjust_lot,
    average_unit_cost,
    consume,
    consume_for_order,
    declare_lot_waste,
    publish_recipe_version,
    receive_lot,
)

pytestmark = pytest.mark.django_db


@pytest.fixture
def as_role(db):
    def authenticated_client(role):
        client = APIClient()
        client.force_authenticate(UserFactory(role=role))
        return client

    return authenticated_client


def make_ingredient(name="Farine", **kwargs):
    return Ingredient.objects.create(
        name=name,
        unit_of_measure="KG",
        **kwargs,
    )


def make_lot(
    ingredient,
    *,
    quantity,
    expiry_date,
    cost="2.00",
    received_date=None,
):
    received_date = received_date or date.today()
    return StockLot.objects.create(
        ingredient=ingredient,
        quantity_received=quantity,
        quantity_remaining=quantity,
        date_received=received_date,
        date_expiration=expiry_date,
        cost_per_unit=cost,
    )


def test_receive_lot_records_movement_and_updates_weighted_cost():
    ingredient = make_ingredient()
    actor = UserFactory(role=Role.MANAGER)
    make_lot(
        ingredient,
        quantity=Decimal("2.00"),
        expiry_date=date.today() + timedelta(days=10),
        cost="3.00",
    )

    lot = receive_lot(
        ingredient,
        Decimal("4.00"),
        Decimal("6.00"),
        date.today(),
        date.today() + timedelta(days=20),
        actor=actor,
    )

    ingredient.refresh_from_db()
    movement = StockMovement.objects.get(lot=lot)
    assert movement.movement_type == "IN"
    assert movement.total_cost == Decimal("24.00")
    assert ingredient.cost_per_unit == Decimal("5.00")
    assert ingredient.get_current_stock_value() == Decimal("30.00")
    assert AuditEvent.objects.filter(action="stock.receive").count() == 1


def test_consume_uses_fefo_order():
    ingredient = make_ingredient()
    later = make_lot(
        ingredient,
        quantity=Decimal("5.00"),
        expiry_date=date.today() + timedelta(days=20),
    )
    sooner = make_lot(
        ingredient,
        quantity=Decimal("5.00"),
        expiry_date=date.today() + timedelta(days=5),
    )

    movements = consume(
        ingredient=ingredient,
        quantity=Decimal("3.00"),
        actor=UserFactory(role=Role.KITCHEN),
        reason="Préparation",
    )

    sooner.refresh_from_db()
    later.refresh_from_db()
    assert [movement.lot_id for movement in movements] == [sooner.pk]
    assert sooner.quantity_remaining == Decimal("2.00")
    assert later.quantity_remaining == Decimal("5.00")


def test_consume_skips_expired_lots():
    ingredient = make_ingredient()
    expired = make_lot(
        ingredient,
        quantity=Decimal("5.00"),
        expiry_date=date.today() - timedelta(days=1),
        received_date=date.today() - timedelta(days=2),
    )
    usable = make_lot(
        ingredient,
        quantity=Decimal("5.00"),
        expiry_date=date.today() + timedelta(days=5),
    )

    movements = consume(
        ingredient=ingredient,
        quantity=Decimal("3.00"),
        actor=UserFactory(role=Role.KITCHEN),
        reason="Préparation",
    )

    expired.refresh_from_db()
    usable.refresh_from_db()
    assert [movement.lot_id for movement in movements] == [usable.pk]
    assert expired.quantity_remaining == Decimal("5.00")
    assert usable.quantity_remaining == Decimal("2.00")


def test_insufficient_stock_rolls_back_partial_consumption():
    ingredient = make_ingredient()
    lot = make_lot(
        ingredient,
        quantity=Decimal("2.00"),
        expiry_date=date.today() + timedelta(days=5),
    )

    with pytest.raises(InsufficientStock):
        consume(
            ingredient=ingredient,
            quantity=Decimal("3.00"),
            actor=UserFactory(role=Role.KITCHEN),
        )

    lot.refresh_from_db()
    assert lot.quantity_remaining == Decimal("2.00")
    assert StockMovement.objects.filter(movement_type="OUT").count() == 0


def test_stock_movement_is_append_only():
    ingredient = make_ingredient()
    lot = make_lot(
        ingredient,
        quantity=Decimal("2.00"),
        expiry_date=date.today() + timedelta(days=5),
    )
    movement = StockMovement.objects.create(
        lot=lot,
        movement_type="IN",
        quantity=Decimal("2.00"),
        unit_cost=Decimal("2.00"),
    )

    movement.notes = "Modification interdite"
    with pytest.raises(RuntimeError):
        movement.save()
    with pytest.raises(RuntimeError):
        movement.delete()


def test_lot_database_constraints_reject_negative_remaining_quantity():
    ingredient = make_ingredient()

    with pytest.raises(IntegrityError), transaction.atomic():
        StockLot.objects.create(
            ingredient=ingredient,
            quantity_received=Decimal("2.00"),
            quantity_remaining=Decimal("-1.00"),
            date_received=date.today(),
            date_expiration=date.today() + timedelta(days=5),
            cost_per_unit=Decimal("2.00"),
        )


def test_average_unit_cost_uses_remaining_lot_value():
    ingredient = make_ingredient()
    make_lot(
        ingredient,
        quantity=Decimal("3.00"),
        expiry_date=date.today() + timedelta(days=5),
        cost="2.00",
    )
    make_lot(
        ingredient,
        quantity=Decimal("1.00"),
        expiry_date=date.today() + timedelta(days=10),
        cost="6.00",
    )

    assert average_unit_cost(ingredient) == Decimal("3.00")


def test_adjustment_and_waste_create_audit_events_and_movements():
    ingredient = make_ingredient()
    lot = make_lot(
        ingredient,
        quantity=Decimal("5.00"),
        expiry_date=date.today() + timedelta(days=5),
    )
    actor = UserFactory(role=Role.MANAGER)

    adjust_lot(
        lot_id=lot.pk,
        counted_quantity=Decimal("4.00"),
        reason="Inventaire physique",
        actor=actor,
    )
    waste = declare_lot_waste(
        lot_id=lot.pk,
        quantity=Decimal("1.00"),
        reason="Produit abîmé",
        actor=actor,
    )

    lot.refresh_from_db()
    assert lot.quantity_remaining == Decimal("3.00")
    assert waste.movement_type == "WST"
    assert AuditEvent.objects.filter(
        action__in=["stock.adjust", "stock.waste"]
    ).count() == 2


def test_threshold_alert_is_created_without_duplicates():
    ingredient = make_ingredient(minimum_stock=Decimal("3.00"))

    receive_lot(
        ingredient,
        Decimal("2.00"),
        Decimal("2.00"),
        date.today(),
        date.today() + timedelta(days=5),
        actor=UserFactory(role=Role.MANAGER),
    )

    assert InventoryAlert.objects.filter(
        ingredient=ingredient,
        alert_type=InventoryAlert.Type.LOW_STOCK,
        is_resolved=False,
    ).count() == 1


def test_daily_alert_command_creates_and_resolves_expiry_alerts():
    ingredient = make_ingredient()
    lot = make_lot(
        ingredient,
        quantity=Decimal("2.000"),
        expiry_date=date.today() + timedelta(days=2),
    )
    output = StringIO()

    call_command("check_stock_alerts", stdout=output)

    alert = InventoryAlert.objects.get(
        stock_lot=lot,
        alert_type=InventoryAlert.Type.EXPIRING,
        is_resolved=False,
    )
    assert "péremption proche" in alert.message
    lot.quantity_remaining = Decimal("0.000")
    lot.save(update_fields=["quantity_remaining", "updated_at"])
    call_command("check_stock_alerts", stdout=StringIO())
    alert.refresh_from_db()
    assert alert.is_resolved


@pytest.mark.skipif(
    connection.vendor != "postgresql",
    reason="select_for_update concurrency requires PostgreSQL",
)
@pytest.mark.django_db(transaction=True)
def test_concurrent_consumption_cannot_overdraw_stock():
    ingredient = make_ingredient()
    lot = make_lot(
        ingredient,
        quantity=Decimal("10.000"),
        expiry_date=date.today() + timedelta(days=5),
    )
    barrier = Barrier(2)

    def consume_in_thread():
        close_old_connections()
        try:
            barrier.wait(timeout=10)
            consume(
                ingredient=ingredient,
                quantity=Decimal("7.000"),
                actor=stock_actor,
            )
            return "consumed"
        except InsufficientStock:
            return "insufficient"
        finally:
            close_old_connections()

    stock_actor = UserFactory(role=Role.KITCHEN)
    with ThreadPoolExecutor(max_workers=2) as executor:
        results = list(executor.map(lambda _: consume_in_thread(), range(2)))

    lot.refresh_from_db()
    assert sorted(results) == ["consumed", "insufficient"]
    assert lot.quantity_remaining == Decimal("3.000")
    assert StockMovement.objects.filter(
        lot=lot, movement_type="OUT"
    ).aggregate(total=Sum("quantity"))["total"] == Decimal("7.000")


def test_kitchen_cannot_read_stock_lots(as_role):
    response = as_role(Role.KITCHEN).get("/api/v1/stock-lots/")
    assert response.status_code == 403


def test_kitchen_ingredient_list_does_not_expose_cost(as_role):
    make_ingredient(cost_per_unit=Decimal("17.00"))

    response = as_role(Role.KITCHEN).get("/api/v1/ingredients/")

    assert response.status_code == 200
    result = response.json()["results"][0]
    assert "cost_per_unit" not in result


def test_inventory_alerts_are_manager_only(as_role):
    ingredient = make_ingredient(minimum_stock=Decimal("1.000"))
    InventoryAlert.objects.create(
        ingredient=ingredient,
        alert_type=InventoryAlert.Type.LOW_STOCK,
        message="Stock bas",
    )

    assert as_role(Role.MANAGER).get("/api/v1/inventory-alerts/").status_code == 200
    assert as_role(Role.KITCHEN).get("/api/v1/inventory-alerts/").status_code == 403


def test_recipe_versions_and_order_consumption_are_idempotent():
    actor = UserFactory(role=Role.MANAGER)
    ingredient = make_ingredient()
    publish_recipe_version(
        menu_item_id="dish-1",
        name="Soupe",
        items=[{"ingredient": ingredient, "quantity_required": Decimal("0.125")}],
        actor=actor,
    )
    order = Order.objects.create(status="CONFIRMED")
    OrderItem.objects.create(
        order=order,
        menu_item_id="dish-1",
        menu_item_name="Soupe",
        quantity=2,
        unit_price=Decimal("8.50"),
    )
    lot = receive_lot(
        ingredient,
        Decimal("1.000"),
        Decimal("2.00"),
        date.today(),
        date.today() + timedelta(days=10),
        actor=actor,
    )

    first = consume_for_order(order, actor=actor)
    replay = consume_for_order(order, actor=actor)

    lot.refresh_from_db()
    assert len(first) == 1
    assert replay == []
    assert lot.quantity_remaining == Decimal("0.750")
    assert RecipeConsumption.objects.filter(order=order).count() == 1


def test_order_uses_recipe_version_valid_at_its_creation_time():
    actor = UserFactory(role=Role.MANAGER)
    old_ingredient = make_ingredient(name="Riz")
    new_ingredient = make_ingredient(name="Lentilles")
    old_recipe = publish_recipe_version(
        menu_item_id="dish-history",
        name="Plat version 1",
        items=[{"ingredient": old_ingredient, "quantity_required": Decimal("0.100")}],
        actor=actor,
    )
    old_order = Order.objects.create(status="CONFIRMED")
    OrderItem.objects.create(
        order=old_order,
        menu_item_id="dish-history",
        menu_item_name="Plat",
        quantity=1,
        unit_price=Decimal("10.00"),
    )
    new_recipe = publish_recipe_version(
        menu_item_id="dish-history",
        name="Plat version 2",
        items=[{"ingredient": new_ingredient, "quantity_required": Decimal("0.200")}],
        actor=actor,
    )
    new_order = Order.objects.create(status="CONFIRMED")
    OrderItem.objects.create(
        order=new_order,
        menu_item_id="dish-history",
        menu_item_name="Plat",
        quantity=1,
        unit_price=Decimal("10.00"),
    )
    receive_lot(
        old_ingredient,
        Decimal("1.000"),
        Decimal("1.00"),
        date.today(),
        date.today() + timedelta(days=10),
        actor=actor,
    )
    receive_lot(
        new_ingredient,
        Decimal("1.000"),
        Decimal("1.00"),
        date.today(),
        date.today() + timedelta(days=10),
        actor=actor,
    )

    old_consumption = consume_for_order(old_order, actor=actor)
    new_consumption = consume_for_order(new_order, actor=actor)

    assert old_consumption[0].recipe_version_id == old_recipe.pk
    assert new_consumption[0].recipe_version_id == new_recipe.pk


def test_recipe_shortage_does_not_block_preparation_and_creates_alert():
    from apps.orders.services import transition_order

    actor = UserFactory(role=Role.KITCHEN)
    ingredient = make_ingredient(minimum_stock=Decimal("1.000"))
    publish_recipe_version(
        menu_item_id="dish-short",
        name="Plat",
        items=[{"ingredient": ingredient, "quantity_required": Decimal("1.000")}],
        actor=UserFactory(role=Role.MANAGER),
    )
    order = Order.objects.create(status="CONFIRMED")
    OrderItem.objects.create(
        order=order,
        menu_item_id="dish-short",
        menu_item_name="Plat",
        quantity=1,
        unit_price=Decimal("10.00"),
    )

    updated = transition_order(order.pk, "PREPARING", actor=actor)

    assert updated.status == "PREPARING"
    assert InventoryAlert.objects.filter(
        ingredient=ingredient,
        alert_type=InventoryAlert.Type.LOW_STOCK,
        is_resolved=False,
    ).exists()
    assert AuditEvent.objects.filter(action="order.stock_shortage").exists()
