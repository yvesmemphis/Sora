from decimal import Decimal
from types import SimpleNamespace

import pytest
from django.test import override_settings
from rest_framework.test import APIClient

from apps.accounts.factories import UserFactory
from apps.menu.factories import DishFactory
from common.constants import OrderStatus, Role
from common.exceptions import DomainError

from .factories import OrderFactory, OrderItemFactory
from .models import Order, OrderStatusHistory
from .services import create_order, transition_order

pytestmark = pytest.mark.django_db


def menu_item(menu_item_id):
    return SimpleNamespace(
        pk=menu_item_id,
        name="Soupe",
        price=Decimal("8.50"),
        is_active=True,
    )


def test_order_uses_server_price_and_is_idempotent(monkeypatch):
    monkeypatch.setattr("apps.orders.services.get_menu_item", menu_item)
    user = UserFactory(role=Role.WAITER)
    payload = {"items": [{"menu_item_id": "soupe", "quantity": 2}]}

    order, created = create_order(payload, user=user, idempotency_key="key-1")

    assert created is True
    assert order.subtotal == Decimal("17.00")
    assert order.total == Decimal("17.00")
    assert order.items.get().unit_price == Decimal("8.50")
    replay, created = create_order(payload, user=user, idempotency_key="key-1")
    assert created is False
    assert replay.pk == order.pk

    with pytest.raises(DomainError) as error:
        create_order(
            {"items": [{"menu_item_id": "soupe", "quantity": 1}]},
            user=user,
            idempotency_key="key-1",
        )
    assert error.value.code == "idempotency_key_conflict"


def test_order_factories_create_consistent_rows():
    order = OrderFactory()
    item = OrderItemFactory(order=order, quantity=3)

    assert item.order == order
    assert item.total_price == item.unit_price * 3


@override_settings(ORDER_TAX_RATE="0.10")
def test_order_calculates_tax_from_server_configuration(monkeypatch):
    monkeypatch.setattr("apps.orders.services.get_menu_item", menu_item)
    order, _ = create_order(
        {"items": [{"menu_item_id": "soupe", "quantity": 1}]},
        user=UserFactory(role=Role.WAITER),
    )

    assert order.subtotal == Decimal("8.50")
    assert order.tax == Decimal("0.85")
    assert order.total == Decimal("9.35")


def test_order_idempotency_key_cannot_be_replayed_by_another_user(monkeypatch):
    monkeypatch.setattr("apps.orders.services.get_menu_item", menu_item)
    owner = UserFactory(role=Role.WAITER)
    other_user = UserFactory(role=Role.WAITER)
    payload = {"items": [{"menu_item_id": "soupe", "quantity": 1}]}
    create_order(payload, user=owner, idempotency_key="private-key")

    with pytest.raises(DomainError) as error:
        create_order(payload, user=other_user, idempotency_key="private-key")
    assert error.value.status_code == 409


def test_order_create_endpoint_rejects_client_supplied_price():
    client = APIClient()
    client.force_authenticate(UserFactory(role=Role.WAITER))

    response = client.post(
        "/api/v1/orders/",
        {"items": [{"menu_item_id": "soupe", "quantity": 1, "unit_price": "0.01"}]},
        format="json",
    )

    assert response.status_code == 400
    assert "unit_price" in response.json()["details"]["items"]["0"]


def test_order_create_uses_local_server_menu_price():
    client = APIClient()
    client.force_authenticate(UserFactory(role=Role.WAITER))
    dish = DishFactory(price="7.25")

    response = client.post(
        "/api/v1/orders/",
        {"items": [{"menu_item_id": str(dish.pk), "quantity": 2}]},
        format="json",
    )

    assert response.status_code == 201
    assert response.data["total"] == "14.50"


def test_transition_is_role_checked_and_historized():
    order = Order.objects.create(status=OrderStatus.CONFIRMED)
    kitchen_user = UserFactory(role=Role.KITCHEN)

    result = transition_order(order.pk, OrderStatus.PREPARING, actor=kitchen_user)

    assert result.status == OrderStatus.PREPARING
    history = OrderStatusHistory.objects.get(
        order=order, to_status=OrderStatus.PREPARING
    )
    assert history.changed_by == kitchen_user


def test_illegal_transition_returns_conflict():
    order = Order.objects.create(status=OrderStatus.RECEIVED)
    manager = UserFactory(role=Role.MANAGER)

    with pytest.raises(DomainError) as error:
        transition_order(order.pk, OrderStatus.READY, actor=manager)

    assert error.value.status_code == 409
    order.refresh_from_db()
    assert order.status == OrderStatus.RECEIVED


def test_waiter_cannot_read_another_waiters_order():
    owner = UserFactory(role=Role.WAITER)
    other_waiter = UserFactory(role=Role.WAITER)
    order = Order.objects.create(created_by=owner)
    client = APIClient()
    client.force_authenticate(other_waiter)

    response = client.get(f"/api/v1/orders/{order.pk}/")

    assert response.status_code == 404


def test_transition_endpoint_returns_409_for_illegal_jump():
    manager = UserFactory(role=Role.MANAGER)
    order = Order.objects.create(status=OrderStatus.RECEIVED)
    client = APIClient()
    client.force_authenticate(manager)

    response = client.post(
        f"/api/v1/orders/{order.pk}/transition/",
        {"status": OrderStatus.READY},
        format="json",
    )

    assert response.status_code == 409
    order.refresh_from_db()
    assert order.status == OrderStatus.RECEIVED


def test_manager_can_reject_and_history_records_the_transition():
    manager = UserFactory(role=Role.MANAGER)
    order = Order.objects.create(status=OrderStatus.RECEIVED)

    updated = transition_order(
        order.pk, OrderStatus.REJECTED, actor=manager, note="Hors service"
    )

    assert updated.status == OrderStatus.REJECTED
    history = OrderStatusHistory.objects.get(order=order)
    assert history.from_status == OrderStatus.RECEIVED
    assert history.to_status == OrderStatus.REJECTED
    assert history.changed_by == manager


def test_cancel_requires_a_reason_and_kitchen_cannot_cancel_preparation():
    manager = UserFactory(role=Role.MANAGER)
    kitchen_user = UserFactory(role=Role.KITCHEN)
    order = Order.objects.create(status=OrderStatus.PREPARING)

    with pytest.raises(DomainError) as error:
        transition_order(order.pk, OrderStatus.CANCELLED, actor=manager)
    assert error.value.code == "reason_required"

    with pytest.raises(DomainError) as error:
        transition_order(
            order.pk,
            OrderStatus.CANCELLED,
            actor=kitchen_user,
            note="Arrêt",
        )
    assert error.value.status_code == 403
