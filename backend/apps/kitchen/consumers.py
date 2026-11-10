import json
from urllib.parse import parse_qs

from channels.db import database_sync_to_async  # type: ignore[import-not-found]
from channels.generic.websocket import AsyncWebsocketConsumer  # type: ignore[import-not-found]
from redis.exceptions import RedisError  # type: ignore[import-not-found]

from .services import _redeem_ticket


class KitchenConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        query = parse_qs(self.scope.get("query_string", b"").decode("utf-8"))
        ticket_values = query.get("ticket", [])
        if len(ticket_values) != 1 or not ticket_values[0]:
            await self.close(code=4001)
            return

        try:
            self.user_id = await database_sync_to_async(_redeem_ticket)(
                ticket_values[0]
            )
        except (RedisError, OSError, ConnectionError):
            await self.close(code=1013)
            return
        if self.user_id is None:
            await self.close(code=4002)
            return

        self.group_name = "kitchen_broadcast"
        try:
            await self.channel_layer.group_add(self.group_name, self.channel_name)
        except (RedisError, OSError, ConnectionError, TimeoutError):
            await self.close(code=1013)
            return
        await self.accept()

    async def disconnect(self, close_code):
        if getattr(self, "group_name", None):
            await self.channel_layer.group_discard(
                self.group_name,
                self.channel_name,
            )

    async def receive(self, text_data=None, bytes_data=None):
        await self.close(code=1008)

    async def order_created(self, event):
        await self.send(
            text_data=json.dumps(
                {
                    "type": "order.created",
                    "order_id": event["order_id"],
                    "status": event["status"],
                }
            )
        )

    async def order_status_changed(self, event):
        await self.send(
            text_data=json.dumps(
                {
                    "type": "order.status_changed",
                    "order_id": event["order_id"],
                    "status": event["status"],
                }
            )
        )
