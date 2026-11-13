from datetime import timedelta

import pytest
from django.core.management import call_command
from django.test import override_settings
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from apps.core.models import RestaurantSettings
from apps.kitchen.models import KitchenQueueItem
from apps.locations.factories import LocationFactory
from apps.menu.factories import DishFactory
from apps.orders.models import Order
from apps.orders.tracking import make_tracking_token

pytestmark = pytest.mark.django_db


def public_order_payload(dish, location, *, quantity=2):
    return {
        "mode": "DINE_IN",
        "location": {"type": "TABLE", "reference": location.reference},
        "items": [{"dish_id": str(dish.pk), "quantity": quantity}],
    }


def test_public_order_uses_server_price_and_signed_tracking():
    dish = DishFactory(price="12.50")
    location = LocationFactory(type="TABLE", reference="T12")
    payload = public_order_payload(dish, location)
    payload["payment_method_expected"] = "cash"
    payload["total"] = "0.01"
    client = APIClient()

    response = client.post(reverse("orders:public-order"), payload, format="json")

    assert response.status_code == 201
    assert response.data["total"] == "25.00"
    assert response.data["currency"] == "XOF"
    assert response.data["payment_method_expected"] == "cash"
    assert response.data["withdrawal_delay_minutes"] == 5
    tracked = client.get(
        reverse("orders:public-track", args=[response.data["tracking_token"]])
    )
    assert tracked.status_code == 200
    assert tracked.data["currency"] == "XOF"
    assert tracked.data["payment_method_expected"] == "cash"
    assert tracked.data["withdrawal_delay_minutes"] == 5
    assert tracked.data["can_cancel"] is True
    assert tracked.data["total"] == "25.00"
    assert tracked.data["items"] == [{"name": dish.name, "quantity": 2}]


def test_public_order_stores_configured_delay_and_normalizes_legacy_payment_code():
    settings = RestaurantSettings.load()
    settings.withdrawal_delay_minutes = 11
    settings.accepted_payment_methods = ["cash"]
    settings.save()
    dish = DishFactory()

    response = APIClient().post(
        reverse("orders:public-order"),
        {
            "mode": "TAKEAWAY",
            "payment_method_expected": "espece",
            "items": [{"dish_id": str(dish.pk), "quantity": 1}],
        },
        format="json",
    )

    assert response.status_code == 201
    assert response.data["payment_method_expected"] == "cash"
    assert response.data["withdrawal_delay_minutes"] == 11
    assert Order.objects.get().withdrawal_delay_minutes == 11


@override_settings(ORDER_TAX_RATE="0.10")
def test_public_order_applies_the_same_server_tax_rate():
    dish = DishFactory(price="12.50")
    location = LocationFactory(type="TABLE", reference="T14")

    response = APIClient().post(
        reverse("orders:public-order"),
        public_order_payload(dish, location),
        format="json",
    )

    assert response.status_code == 201
    assert response.data["total"] == "27.50"


def test_public_order_idempotency_replays_only_same_payload():
    dish = DishFactory()
    location = LocationFactory(type="TABLE", reference="T13")
    client = APIClient()
    url = reverse("orders:public-order")
    payload = public_order_payload(dish, location)

    first = client.post(
        url, payload, format="json", HTTP_IDEMPOTENCY_KEY="public-key-1"
    )
    replay = client.post(
        url, payload, format="json", HTTP_IDEMPOTENCY_KEY="public-key-1"
    )
    changed = client.post(
        url,
        public_order_payload(dish, location, quantity=3),
        format="json",
        HTTP_IDEMPOTENCY_KEY="public-key-1",
    )

    assert (first.status_code, replay.status_code, changed.status_code) == (
        201,
        200,
        409,
    )
    assert Order.objects.filter(idempotency_key="public-key-1").count() == 1


def test_public_order_idempotency_includes_expected_payment_method():
    dish = DishFactory()
    location = LocationFactory(type="TABLE", reference="T15")
    client = APIClient()
    url = reverse("orders:public-order")
    payload = public_order_payload(dish, location)
    payload["payment_method_expected"] = "cash"

    first = client.post(
        url, payload, format="json", HTTP_IDEMPOTENCY_KEY="public-payment-key"
    )
    payload["payment_method_expected"] = "card"
    changed = client.post(
        url, payload, format="json", HTTP_IDEMPOTENCY_KEY="public-payment-key"
    )

    assert first.status_code == 201
    assert changed.status_code == 409


def test_public_track_rejects_forged_tokens():
    response = APIClient().get(reverse("orders:public-track", args=["bad.token"]))
    assert response.status_code == 404


def test_public_tracking_qr_encodes_the_signed_tracking_url():
    order = Order.objects.create(source="PUBLIC", status="RECEIVED")
    response = APIClient().get(
        reverse("orders:public-track-qr", args=[make_tracking_token(order)])
    )

    assert response.status_code == 200
    assert response["Content-Type"] == "image/png"
    assert response.content.startswith(b"\x89PNG\r\n\x1a\n")
    assert "/suivi/" in response["X-QR-Target"]


def test_client_can_cancel_public_order_within_withdrawal_window():
    order = Order.objects.create(source="PUBLIC", status="RECEIVED")
    response = APIClient().post(
        reverse(
            "orders:public-track-cancel",
            args=[make_tracking_token(order)],
        )
    )

    assert response.status_code == 204
    order.refresh_from_db()
    assert order.status == "CANCELLED"


def test_client_cannot_cancel_public_order_after_withdrawal_window():
    order = Order.objects.create(source="PUBLIC", status="RECEIVED")
    Order.objects.filter(pk=order.pk).update(
        created_at=timezone.now() - timedelta(minutes=6)
    )
    response = APIClient().post(
        reverse(
            "orders:public-track-cancel",
            args=[make_tracking_token(order)],
        )
    )

    assert response.status_code == 409
    order.refresh_from_db()
    assert order.status == "RECEIVED"


def test_client_cannot_cancel_confirmed_public_order():
    order = Order.objects.create(source="PUBLIC", status="CONFIRMED")
    response = APIClient().post(
        reverse(
            "orders:public-track-cancel",
            args=[make_tracking_token(order)],
        )
    )

    assert response.status_code == 409
    order.refresh_from_db()
    assert order.status == "CONFIRMED"


def test_auto_confirmed_public_order_waits_for_withdrawal_deadline():
    dish = DishFactory()
    settings = RestaurantSettings.load()
    settings.auto_confirm_orders = True
    settings.save()

    response = APIClient().post(
        reverse("orders:public-order"),
        {
            "mode": "TAKEAWAY",
            "items": [{"dish_id": str(dish.pk), "quantity": 1}],
        },
        format="json",
    )

    assert response.status_code == 201
    assert response.data["withdrawal_delay_minutes"] == 5
    order = Order.objects.get()
    assert order.status == "RECEIVED"
    assert not KitchenQueueItem.objects.exists()

    Order.objects.filter(pk=order.pk).update(
        created_at=timezone.now() - timedelta(minutes=6)
    )
    assert call_command("process_public_order_timeouts") is None

    order.refresh_from_db()
    assert order.status == "CONFIRMED"
    assert KitchenQueueItem.objects.get().status == "CONFIRMED"
