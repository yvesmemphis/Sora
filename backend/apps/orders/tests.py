from datetime import timedelta
from decimal import Decimal
from types import SimpleNamespace

import pytest
from django.test import override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from apps.accounts.factories import UserFactory
from apps.locations.factories import LocationFactory
from apps.menu.factories import DishFactory
from apps.payments.models import Payment, Refund
from common.constants import LocationType, OrderMode, OrderStatus, Role
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
    assert response.data["currency"] == "XOF"


def test_staff_order_stores_expected_payment_method(monkeypatch):
    monkeypatch.setattr("apps.orders.services.get_menu_item", menu_item)
    order, _ = create_order(
        {
            "items": [{"menu_item_id": "soupe", "quantity": 1}],
            "payment_method_expected": "cash",
        },
        user=UserFactory(role=Role.WAITER),
    )

    assert order.payment_method_expected == "cash"


def test_staff_order_rejects_location_incompatible_with_mode(monkeypatch):
    monkeypatch.setattr("apps.orders.services.get_menu_item", menu_item)
    user = UserFactory(role=Role.WAITER)
    room = LocationFactory(type=LocationType.ROOM)

    with pytest.raises(DomainError) as error:
        create_order(
            {
                "items": [{"menu_item_id": "soupe", "quantity": 1}],
                "mode": OrderMode.DINE_IN,
                "location": room,
            },
            user=user,
        )

    assert error.value.code == "invalid_location"


def test_order_location_can_change_before_preparation_and_is_audited():
    from apps.audit.models import AuditEvent

    waiter = UserFactory(role=Role.WAITER)
    first_location = LocationFactory(type=LocationType.TABLE, reference="T1")
    second_location = LocationFactory(type=LocationType.TABLE, reference="T2")
    order = OrderFactory(
        created_by=waiter,
        mode=OrderMode.DINE_IN,
        location=first_location,
        status=OrderStatus.RECEIVED,
    )
    client = APIClient()
    client.force_authenticate(waiter)

    response = client.patch(
        f"/api/v1/orders/{order.pk}/location/",
        {"location": str(second_location.pk)},
        format="json",
    )

    assert response.status_code == 200
    assert response.json()["location_reference"] == "T2"
    assert AuditEvent.objects.filter(action="order.location_changed").exists()


def test_order_location_cannot_change_after_preparation():
    waiter = UserFactory(role=Role.WAITER)
    order = OrderFactory(
        created_by=waiter,
        mode=OrderMode.DINE_IN,
        location=LocationFactory(type=LocationType.TABLE),
        status=OrderStatus.PREPARING,
    )
    client = APIClient()
    client.force_authenticate(waiter)

    response = client.patch(
        f"/api/v1/orders/{order.pk}/location/",
        {"location": str(LocationFactory(type=LocationType.TABLE).pk)},
        format="json",
    )

    assert response.status_code == 409


def test_waiter_can_list_all_current_active_orders():
    waiter = UserFactory(role=Role.WAITER)
    active_public_order = Order.objects.create(
        source="PUBLIC",
        status=OrderStatus.RECEIVED,
    )
    active_staff_order = Order.objects.create(
        source="STAFF",
        status=OrderStatus.CONFIRMED,
        created_by=UserFactory(role=Role.WAITER),
    )
    Order.objects.create(source="PUBLIC", status=OrderStatus.COMPLETED)
    old_public_order = Order.objects.create(
        source="PUBLIC",
        status=OrderStatus.RECEIVED,
    )
    Order.objects.filter(pk=old_public_order.pk).update(
        created_at=timezone.now() - timedelta(days=1)
    )
    client = APIClient()
    client.force_authenticate(waiter)

    response = client.get("/api/v1/orders/")

    assert response.status_code == 200
    assert {item["id"] for item in response.data} == {
        active_public_order.pk,
        active_staff_order.pk,
    }


def test_order_response_includes_location_payment_summary_and_history():
    location = LocationFactory(type=LocationType.TABLE, reference="T6")
    order = Order.objects.create(
        status=OrderStatus.SERVED,
        location=location,
        total=Decimal("9.00"),
        currency="XOF",
    )
    payment = Payment.objects.create(
        order=order,
        amount=Decimal("10.00"),
        currency="XOF",
        status="CONFIRMED",
        payment_method="espece",
    )
    Refund.objects.create(
        payment=payment,
        amount=Decimal("2.00"),
        reason="Ajustement",
        status="COMPLETED",
    )
    OrderStatusHistory.objects.create(
        order=order,
        from_status=OrderStatus.READY,
        to_status=OrderStatus.SERVED,
        note="Servie",
    )
    client = APIClient()
    client.force_authenticate(UserFactory(role=Role.MANAGER))

    response = client.get(f"/api/v1/orders/{order.pk}/")

    assert response.status_code == 200
    assert response.data["location_type"] == LocationType.TABLE
    assert response.data["location_reference"] == "T6"
    assert response.data["amount_paid"] == Decimal("8.00")
    assert response.data["is_paid"] is False
    assert response.data["currency"] == "XOF"
    assert response.data["status_history"][0]["note"] == "Servie"


def test_orders_support_filters_and_opt_in_pagination():
    manager = UserFactory(role=Role.MANAGER)
    first = Order.objects.create(status=OrderStatus.RECEIVED)
    second = Order.objects.create(status=OrderStatus.CONFIRMED)
    client = APIClient()
    client.force_authenticate(manager)

    legacy_list = client.get("/api/v1/orders/")
    filtered = client.get(
        f"/api/v1/orders/?status=RECEIVED&date={timezone.localdate().isoformat()}"
    )
    paginated = client.get("/api/v1/orders/?page=1&page_size=1")

    assert legacy_list.status_code == 200
    assert isinstance(legacy_list.data, list)
    assert [order["id"] for order in filtered.data] == [first.pk]
    assert paginated.data["count"] == 2
    assert len(paginated.data["results"]) == 1
    assert paginated.data["results"][0]["id"] in {first.pk, second.pk}


@pytest.mark.parametrize(
    ("current_status", "target_status"),
    [
        (OrderStatus.RECEIVED, OrderStatus.CANCELLED),
        (OrderStatus.RECEIVED, OrderStatus.REJECTED),
        (OrderStatus.CONFIRMED, OrderStatus.CANCELLED),
        (OrderStatus.CONFIRMED, OrderStatus.REJECTED),
    ],
)
def test_waiter_can_cancel_or_reject_active_public_order(
    current_status, target_status
):
    waiter = UserFactory(role=Role.WAITER)
    order = Order.objects.create(source="PUBLIC", status=current_status)

    updated = transition_order(
        order.pk,
        target_status,
        actor=waiter,
        note="Indisponible",
    )

    assert updated.status == target_status


def test_waiter_cannot_cancel_previous_day_public_order():
    waiter = UserFactory(role=Role.WAITER)
    order = Order.objects.create(source="PUBLIC", status=OrderStatus.RECEIVED)
    Order.objects.filter(pk=order.pk).update(
        created_at=timezone.now() - timedelta(days=1)
    )

    with pytest.raises(DomainError) as error:
        transition_order(
            order.pk,
            OrderStatus.CANCELLED,
            actor=waiter,
            note="Annulation",
        )

    assert error.value.status_code == 403


def test_waiter_cancellation_requires_a_reason():
    waiter = UserFactory(role=Role.WAITER)
    order = Order.objects.create(source="PUBLIC", status=OrderStatus.RECEIVED)

    with pytest.raises(DomainError) as error:
        transition_order(order.pk, OrderStatus.CANCELLED, actor=waiter)

    assert error.value.code == "reason_required"


def test_kitchen_orders_include_location_and_update_timestamp():
    location = LocationFactory(type=LocationType.ROOM, reference="204")
    order = Order.objects.create(
        status=OrderStatus.PREPARING,
        mode=OrderMode.ROOM,
        location=location,
    )
    client = APIClient()
    client.force_authenticate(UserFactory(role=Role.KITCHEN))

    response = client.get("/api/v1/orders/")

    assert response.status_code == 200
    result = response.data[0]
    assert result["id"] == order.pk
    assert result["location_type"] == LocationType.ROOM
    assert result["location_reference"] == "204"
    assert result["updated_at"]


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


def test_waiter_can_read_another_waiters_active_order_today():
    owner = UserFactory(role=Role.WAITER)
    other_waiter = UserFactory(role=Role.WAITER)
    order = Order.objects.create(created_by=owner)
    client = APIClient()
    client.force_authenticate(other_waiter)

    response = client.get(f"/api/v1/orders/{order.pk}/")

    assert response.status_code == 200


def test_waiter_cannot_read_another_waiters_order_from_previous_day():
    owner = UserFactory(role=Role.WAITER)
    other_waiter = UserFactory(role=Role.WAITER)
    order = Order.objects.create(created_by=owner)
    Order.objects.filter(pk=order.pk).update(
        created_at=timezone.now() - timedelta(days=1)
    )
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
