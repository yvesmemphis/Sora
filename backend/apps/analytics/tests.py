from datetime import date, datetime, time, timedelta
from decimal import Decimal
from io import StringIO

import pytest
from django.core.exceptions import PermissionDenied, ValidationError
from django.core.management import call_command
from django.test import override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from apps.accounts.factories import UserFactory
from apps.audit.models import AuditEvent
from apps.inventory.models import (
    Ingredient,
    RecipeConsumption,
    RecipeItem,
    RecipeVersion,
    StockLot,
    StockMovement,
)
from apps.orders.models import Order, OrderItem
from apps.payments.models import Payment, Refund
from common.constants import Role

from .models import Forecast
from .services import forecast_dish, overview, review_forecast

pytestmark = pytest.mark.django_db


def create_order(day, *, status="COMPLETED", item=None, quantity=1):
    order = Order.objects.create(status=status)
    created_at = timezone.make_aware(datetime.combine(day, time(12)))
    Order.objects.filter(pk=order.pk).update(created_at=created_at)
    order.refresh_from_db()
    if item:
        OrderItem.objects.create(
            order=order,
            menu_item_id=item,
            menu_item_name=f"Dish {item}",
            quantity=quantity,
            unit_price=Decimal("10.00"),
            total_price=Decimal("10.00") * quantity,
        )
    return order


def create_payment(order, *, amount="10.00", status="CONFIRMED", currency="EUR"):
    payment = Payment.objects.create(
        order=order,
        amount=Decimal(amount),
        status=status,
        currency=currency,
        payment_method="cash",
    )
    Payment.objects.filter(pk=payment.pk).update(
        created_at=order.created_at,
        captured_at=order.created_at,
    )
    return payment


def test_overview_counts_orders_payments_and_nets_completed_refunds():
    day = date(2026, 11, 10)
    completed = create_order(day)
    cancelled = create_order(day, status="CANCELLED")
    payment = create_payment(completed, amount="30.00")
    create_payment(cancelled, amount="7.00", status="FAILED")
    Refund.objects.create(
        payment=payment,
        amount=Decimal("8.00"),
        reason="Customer refund",
        status="COMPLETED",
        processed_at=timezone.make_aware(datetime.combine(day, time(13))),
    )

    result = overview(day, day)

    assert result["orders"] == {"total": 2, "completed": 1, "cancelled": 1}
    assert result["payments"] == {
        "CONFIRMED": 1,
        "FAILED": 1,
        "PENDING": 0,
        "REFUNDED": 0,
    }
    assert result["revenue"] == {"EUR": "22.00"}


def test_overview_rejects_reversed_and_overlong_date_ranges():
    day = date(2026, 11, 10)
    assert (
        overview(day - timedelta(days=365), day)["start_date"]
        == (day - timedelta(days=365)).isoformat()
    )
    with pytest.raises(ValidationError):
        overview(day, day - timedelta(days=1))
    with pytest.raises(ValidationError):
        overview(day - timedelta(days=366), day)


def test_overview_includes_dish_hour_basket_and_cost_indicators():
    today = timezone.localdate()
    order = Order.objects.create(
        status="COMPLETED",
        subtotal=Decimal("10.00"),
        total=Decimal("10.00"),
        currency="XOF",
    )
    Order.objects.filter(pk=order.pk).update(created_at=timezone.now())
    order.refresh_from_db()
    item = OrderItem.objects.create(
        order=order,
        menu_item_id="dish-1",
        menu_item_name="Soupe",
        quantity=2,
        unit_price=Decimal("5.00"),
        total_price=Decimal("10.00"),
    )
    ingredient = Ingredient.objects.create(name="Légumes")
    recipe = RecipeVersion.objects.create(
        name="Soupe",
        menu_item_id=item.menu_item_id,
        version_number=1,
    )
    recipe_item = RecipeItem.objects.create(
        recipe_version=recipe,
        ingredient=ingredient,
        quantity_required=Decimal("1.000"),
    )
    lot = StockLot.objects.create(
        ingredient=ingredient,
        quantity_received=Decimal("10.000"),
        quantity_remaining=Decimal("8.000"),
        date_received=today,
        date_expiration=today + timedelta(days=10),
        cost_per_unit=Decimal("1.00"),
    )
    StockMovement.objects.create(
        lot=lot,
        movement_type="OUT",
        quantity=Decimal("2.000"),
        unit_cost=Decimal("1.00"),
        reference_order=order,
    )
    RecipeConsumption.objects.create(
        recipe_version=recipe,
        recipe_item=recipe_item,
        order=order,
        quantity_consumed_per_item=Decimal("2.000"),
    )

    result = overview(today, today)

    assert result["popular_dishes"] == [
        {"menu_item_id": "dish-1", "menu_item_name": "Soupe", "quantity": 2}
    ]
    assert result["average_baskets"] == [
        {
            "currency": "XOF",
            "completed_orders": 1,
            "average_subtotal": "10.00",
        }
    ]
    assert result["margins_and_costs"] == [
        {
            "currency": "XOF",
            "cost_currency": "XOF",
            "sales": "10.00",
            "estimated_cost": "2.00",
            "cost_coverage": "1.0000",
            "gross_margin": "8.00",
        }
    ]
    assert len(result["orders_by_hour"]) == 24


@override_settings(ROOT_URLCONF="apps.analytics.urls")
def test_overview_role_visibility():
    today = timezone.localdate()
    create_order(today)
    create_order(today, status="CANCELLED")
    manager_client = APIClient()
    manager_client.force_authenticate(UserFactory(role=Role.MANAGER))
    kitchen_client = APIClient()
    kitchen_client.force_authenticate(UserFactory(role=Role.KITCHEN))
    waiter_client = APIClient()
    waiter_client.force_authenticate(UserFactory(role=Role.WAITER))

    manager_data = manager_client.get("/analytics/overview/").data
    kitchen_data = kitchen_client.get("/analytics/overview/").data
    waiter_data = waiter_client.get("/analytics/overview/?start_date=invalid").data

    assert "revenue" in manager_data
    assert "revenue" not in kitchen_data
    assert waiter_data == {"daily_order_count": 2}


@override_settings(ROOT_URLCONF="apps.analytics.urls")
def test_overview_endpoint_validates_date_range():
    client = APIClient()
    client.force_authenticate(UserFactory(role=Role.MANAGER))
    response = client.get(
        "/analytics/overview/",
        {"start_date": "2025-11-09", "end_date": "2026-11-10"},
    )
    assert response.status_code == 400


def test_forecast_dish_averages_matching_weekdays_and_versions_results():
    target = date(2026, 11, 10)
    for weeks_ago, quantity in ((1, 3), (2, 5), (3, None)):
        create_order(
            target - timedelta(weeks=weeks_ago),
            item="dish-1" if quantity is not None else None,
            quantity=quantity or 1,
        )

    first = forecast_dish(target)
    second = forecast_dish(target)

    assert len(first) == 1
    assert first[0].predicted_quantity == Decimal("2.67")
    assert first[0].confidence > 0
    assert len(first[0].explanation["observations"]) == 3
    assert second[0].pk == first[0].pk
    assert second[0].version == 1
    assert Forecast.objects.count() == 1


def test_forecast_dish_skips_insufficient_history():
    target = date(2026, 11, 10)
    create_order(target - timedelta(weeks=1), item="dish-1")
    create_order(target - timedelta(weeks=2), item="dish-1")

    assert forecast_dish(target) == []
    assert Forecast.objects.count() == 0


def test_generate_forecasts_management_command():
    target = date(2026, 11, 10)
    for weeks_ago in (1, 2, 3):
        create_order(target - timedelta(weeks=weeks_ago), item="dish-1")

    output = StringIO()
    call_command(
        "generate_forecasts",
        target_date=target.isoformat(),
        stdout=output,
    )

    assert Forecast.objects.count() == 1
    assert "Created 1 forecast(s)" in output.getvalue()


def test_forecast_review_is_manager_only_and_audited():
    forecast = Forecast.objects.create(
        menu_item_id="dish-1",
        menu_item_name="Dish dish-1",
        period_start=date(2026, 11, 10),
        period_end=date(2026, 11, 10),
        version=1,
        predicted_quantity=Decimal("2.00"),
        confidence=Decimal("0.7500"),
    )
    waiter = UserFactory(role=Role.WAITER)
    with pytest.raises(PermissionDenied):
        review_forecast(forecast_id=forecast.pk, actor=waiter, approve=True)

    manager = UserFactory(role=Role.MANAGER)
    reviewed = review_forecast(
        forecast_id=forecast.pk,
        actor=manager,
        approve=False,
        reason="Seasonal change",
    )

    assert reviewed.status == Forecast.Status.REJECTED
    assert reviewed.reviewed_by == manager
    assert reviewed.rejection_reason == "Seasonal change"
    event = AuditEvent.objects.get(action="analytics.forecast.reject")
    assert event.actor == manager
    assert event.resource_id == str(forecast.pk)


@override_settings(ROOT_URLCONF="apps.analytics.urls")
def test_forecast_review_endpoint_restricts_roles():
    forecast = Forecast.objects.create(
        menu_item_id="dish-1",
        menu_item_name="Dish dish-1",
        period_start=date(2026, 11, 10),
        period_end=date(2026, 11, 10),
        version=1,
        predicted_quantity=Decimal("2.00"),
        confidence=Decimal("0.7500"),
    )
    client = APIClient()
    client.force_authenticate(UserFactory(role=Role.WAITER))
    denied = client.post(f"/analytics/forecasts/{forecast.pk}/approve/")
    assert denied.status_code == 403

    client.force_authenticate(UserFactory(role=Role.ADMIN))
    allowed = client.post(f"/analytics/forecasts/{forecast.pk}/approve/")
    assert allowed.status_code == 200
    assert allowed.data["status"] == Forecast.Status.APPROVED
