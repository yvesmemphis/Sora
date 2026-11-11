import hashlib
import hmac

from django.conf import settings
from django.http import Http404

from .models import Order


def make_tracking_token(order):
    signature = hmac.new(
        settings.TRACKING_TOKEN_KEY.encode(), str(order.pk).encode(), hashlib.sha256
    ).hexdigest()[:40]
    return f"{order.pk}.{signature}"


def order_from_tracking_token(token):
    try:
        order_id, signature = token.split(".")
        order = (
            Order.objects.prefetch_related("items")
            .only("id", "number", "status", "created_at")
            .get(pk=order_id)
        )
    except (TypeError, ValueError, Order.DoesNotExist):
        raise Http404 from None

    expected = make_tracking_token(order).split(".")[1]
    if not hmac.compare_digest(signature, expected):
        raise Http404
    return order
