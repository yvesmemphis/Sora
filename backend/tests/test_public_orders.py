import pytest
from django.urls import reverse
from rest_framework.test import APIClient

from apps.core.models import RestaurantSettings
from apps.kitchen.models import KitchenQueueItem
from apps.locations.factories import LocationFactory
from apps.menu.factories import DishFactory
from apps.orders.models import Order

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
    payload["total"] = "0.01"
    client = APIClient()

    response = client.post(reverse("orders:public-order"), payload, format="json")

    assert response.status_code == 201
    assert response.data["total"] == "25.00"
    tracked = client.get(
        reverse("orders:public-track", args=[response.data["tracking_token"]])
    )
    assert tracked.status_code == 200
    assert tracked.data["items"] == [{"name": dish.name, "quantity": 2}]


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


def test_public_track_rejects_forged_tokens():
    response = APIClient().get(reverse("orders:public-track", args=["bad.token"]))
    assert response.status_code == 404


def test_auto_confirmed_public_order_enters_kitchen_queue():
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
    assert KitchenQueueItem.objects.get().status == "CONFIRMED"
