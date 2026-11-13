
import pytest

from apps.accounts.factories import UserFactory
from apps.orders.models import Order
from common.constants import Role

from .services import send_order_notification

pytestmark = pytest.mark.django_db


def test_public_order_email_is_sent_to_manager_and_kitchen(monkeypatch):
    manager = UserFactory(role=Role.MANAGER)
    kitchen = UserFactory(role=Role.KITCHEN)
    waiter = UserFactory(role=Role.WAITER)
    order = Order.objects.create(source="PUBLIC", total="12.00", currency="XOF")
    sent = []

    def fake_send_mail(subject, message, sender, recipients, **kwargs):
        sent.append((subject, message, sender, recipients, kwargs))
        return 1

    monkeypatch.setattr("apps.notifications.services.send_mail", fake_send_mail)

    assert send_order_notification(order_id=order.pk, event_type="order.created") == 2
    assert {message[3][0] for message in sent} == {manager.email, kitchen.email}
    assert waiter.email not in {message[3][0] for message in sent}
    assert all("12.00 XOF" in message[1] for message in sent)
