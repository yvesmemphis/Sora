import asyncio
import json
from datetime import timedelta

import pytest
from channels.layers import get_channel_layer
from channels.testing import WebsocketCommunicator
from django.utils import timezone
from rest_framework.test import APIClient

from apps.accounts.factories import UserFactory
from apps.orders.models import Order
from apps.orders.services import transition_order
from common.constants import OrderStatus, Role

from .consumers import KitchenConsumer
from .models import KitchenQueueItem
from .services import generate_kitchen_ticket, publish_order_event

pytestmark = pytest.mark.django_db(transaction=True)


def test_kitchen_ticket_endpoint_requires_kitchen_role():
    client = APIClient()
    client.force_authenticate(UserFactory(role=Role.WAITER))

    response = client.post("/api/v1/kitchen/tickets/")

    assert response.status_code == 403


def test_queue_resync_uses_updated_after_and_minimal_data():
    kitchen_user = UserFactory(role=Role.KITCHEN)
    order = Order.objects.create(status="PREPARING", customer_name="Private name")
    KitchenQueueItem.objects.create(order=order, status="PREPARING")
    client = APIClient()
    client.force_authenticate(kitchen_user)

    response = client.get(
        f"/api/v1/kitchen/queue/?updated_after="
        f"{(timezone.now() - timedelta(minutes=1)).strftime('%Y-%m-%dT%H:%M:%SZ')}"
    )

    assert response.status_code == 200
    result = response.json()[0]
    assert result["order_number"] == str(order.pk)
    assert "customer_name" not in result
    assert "unit_price" not in json.dumps(result)


def test_queue_rejects_invalid_updated_after():
    client = APIClient()
    client.force_authenticate(UserFactory(role=Role.KITCHEN))

    response = client.get("/api/v1/kitchen/queue/?updated_after=not-a-date")

    assert response.status_code == 400


def test_confirmed_order_is_visible_in_the_kitchen_queue():
    order = Order.objects.create(status=OrderStatus.RECEIVED)
    manager = UserFactory(role=Role.MANAGER)
    transition_order(order.pk, OrderStatus.CONFIRMED, actor=manager)
    client = APIClient()
    client.force_authenticate(UserFactory(role=Role.KITCHEN))

    response = client.get("/api/v1/kitchen/queue/")

    assert response.status_code == 200
    assert response.json()[0]["status"] == "CONFIRMED"


def test_queue_delta_includes_served_status_as_a_removal_tombstone():
    client = APIClient()
    client.force_authenticate(UserFactory(role=Role.KITCHEN))
    order = Order.objects.create(status="SERVED")
    KitchenQueueItem.objects.create(order=order, status="SERVED")
    updated_after = (timezone.now() - timedelta(minutes=1)).strftime(
        "%Y-%m-%dT%H:%M:%SZ"
    )

    delta = client.get(f"/api/v1/kitchen/queue/?updated_after={updated_after}")
    full_queue = client.get("/api/v1/kitchen/queue/")

    assert delta.status_code == 200
    assert delta.json()[0]["status"] == "SERVED"
    assert full_queue.json() == []


def test_websocket_ticket_is_single_use_and_broadcasts_minimal_event():
    user = UserFactory(role=Role.KITCHEN)
    ticket = generate_kitchen_ticket(user=user)

    async def run():
        communicator = WebsocketCommunicator(
            KitchenConsumer.as_asgi(),
            f"/ws/kitchen/?ticket={ticket}",
        )
        connected, _ = await communicator.connect()
        assert connected

        await get_channel_layer().group_send(
            "kitchen_broadcast",
            {
                "type": "order.created",
                "order_id": "42",
                "status": "RECEIVED",
                "total": "secret",
            },
        )
        event = json.loads(await communicator.receive_from())
        assert event == {
            "type": "order.created",
            "order_id": "42",
            "status": "RECEIVED",
        }
        await communicator.disconnect()

        replay = WebsocketCommunicator(
            KitchenConsumer.as_asgi(),
            f"/ws/kitchen/?ticket={ticket}",
        )
        accepted, _ = await replay.connect()
        assert not accepted

    asyncio.run(run())


def test_websocket_without_ticket_is_rejected():
    async def run():
        communicator = WebsocketCommunicator(
            KitchenConsumer.as_asgi(),
            "/ws/kitchen/",
        )
        accepted, _ = await communicator.connect()
        assert not accepted

    asyncio.run(run())


def test_redis_broadcast_failure_does_not_raise(monkeypatch):
    class UnavailableLayer:
        async def group_send(self, group, event):
            raise ConnectionError("Redis unavailable")

    monkeypatch.setattr(
        "apps.kitchen.services.get_channel_layer",
        lambda: UnavailableLayer(),
    )

    publish_order_event("42", "order.created", "RECEIVED")
