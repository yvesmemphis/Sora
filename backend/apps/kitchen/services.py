import logging
import secrets
from datetime import timedelta

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.core.cache import cache
from django.db import transaction
from django.utils import timezone

from common.constants import Role
from common.exceptions import DomainError

from .models import KitchenQueueItem, KitchenTicket

logger = logging.getLogger(__name__)
TICKET_TTL_SECONDS = 30


@transaction.atomic
def generate_kitchen_ticket(*, user):
    if not user or not user.is_authenticated or user.role != Role.KITCHEN:
        raise DomainError("permission_denied", "Réservé au rôle cuisine.", 403)

    token = secrets.token_urlsafe(24)
    expires_at = timezone.now() + timedelta(seconds=TICKET_TTL_SECONDS)
    ticket = KitchenTicket.objects.create(
        ticket_id=token,
        user=user,
        expires_at=expires_at,
    )
    try:
        stored = cache.add(
            f"kitchen_ticket:{token}",
            str(ticket.pk),
            timeout=TICKET_TTL_SECONDS,
        )
    except Exception as exc:
        raise DomainError(
            "ticket_store_unavailable",
            "Le service de tickets cuisine est indisponible.",
            503,
        ) from exc
    if not stored:
        raise DomainError("ticket_collision", "Impossible de créer le ticket.", 503)
    return token


def _redeem_ticket(ticket_id):
    cached_ticket_id = cache.get(f"kitchen_ticket:{ticket_id}")
    if cached_ticket_id is None:
        return None

    with transaction.atomic():
        ticket = (
            KitchenTicket.objects.select_for_update()
            .filter(pk=cached_ticket_id, ticket_id=ticket_id)
            .select_related("user")
            .first()
        )
        if (
            ticket is None
            or ticket.is_used
            or not ticket.is_active
            or ticket.expires_at <= timezone.now()
            or ticket.user is None
            or not ticket.user.is_active
            or ticket.user.role != Role.KITCHEN
        ):
            return None

        ticket.use()
        user_id = ticket.user_id

    try:
        cache.delete(f"kitchen_ticket:{ticket_id}")
    except Exception as exc:
        logger.warning(
            "Kitchen ticket cache cleanup unavailable: %s",
            type(exc).__name__,
        )
    return user_id


def publish_order_event(order_id, event_type, order_status):
    channel_layer = get_channel_layer()
    if channel_layer is None:
        return
    event = {
        "type": event_type.replace(".", "_"),
        "order_id": str(order_id),
        "status": str(order_status),
    }
    try:
        async_to_sync(channel_layer.group_send)("kitchen_broadcast", event)
    except Exception as exc:
        logger.warning(
            "Kitchen event broadcast unavailable for order %s: %s",
            order_id,
            type(exc).__name__,
        )


@transaction.atomic
def update_kitchen_queue(order, status="PREPARING"):

    queue_item, _ = KitchenQueueItem.objects.update_or_create(
        order=order,
        defaults={"status": status},
    )
    return queue_item
