from datetime import timedelta

import pytest
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from apps.accounts.factories import UserFactory
from apps.audit.models import AuditEvent
from apps.audit.services import log
from common.constants import Role

pytestmark = pytest.mark.django_db


def test_log_removes_sensitive_metadata_keys(as_role):
    actor = UserFactory(role=Role.ADMIN)
    event = log(
        actor=actor,
        action="payment.create",
        metadata={"amount": "10.00", "refresh_token": "hidden", "secret": "hidden"},
    )

    assert event.metadata == {"amount": "10.00"}


def test_only_admin_can_read_audit(as_role):
    actor = UserFactory(role=Role.ADMIN)
    AuditEvent.objects.create(actor=actor, action="test.action")

    assert as_role(Role.MANAGER).get(reverse("audit-list")).status_code == 403
    assert as_role(Role.ADMIN).get(reverse("audit-list")).status_code == 200


def test_admin_can_filter_audit_by_date_actor_and_module():
    actor = UserFactory(role=Role.ADMIN)
    today = timezone.localdate()
    matching = AuditEvent.objects.create(
        actor=actor,
        action="order.created",
        resource_type="apps.orders.Order",
    )
    other_actor = UserFactory(role=Role.ADMIN)
    AuditEvent.objects.create(
        actor=other_actor,
        action="payment.registered",
        resource_type="apps.payments.Payment",
    )
    AuditEvent.objects.filter(pk=matching.pk).update(
        created_at=timezone.now() - timedelta(days=1)
    )

    client = APIClient()
    client.force_authenticate(actor)
    response = client.get(
        reverse("audit-list"),
        {
            "date_from": (today - timedelta(days=1)).isoformat(),
            "date_to": today.isoformat(),
            "actor": str(actor.pk),
            "module": "orders",
        },
    )

    assert response.status_code == 200
    assert response.data["count"] == 1
    assert response.data["results"][0]["id"] == str(matching.pk)


def test_audit_date_range_must_be_ordered():
    client = APIClient()
    client.force_authenticate(UserFactory(role=Role.ADMIN))

    response = client.get(
        reverse("audit-list"),
        {
            "date_from": (timezone.localdate() + timedelta(days=1)).isoformat(),
            "date_to": timezone.localdate().isoformat(),
        },
    )

    assert response.status_code == 400


def test_analytics_module_filter_and_csv_export_use_server_query_filters():
    actor = UserFactory(role=Role.ADMIN)
    forecast_event = AuditEvent.objects.create(
        actor=actor,
        action="analytics.forecast.reject",
        resource_type="apps.analytics.forecast",
    )
    AuditEvent.objects.create(
        actor=actor,
        action="payment.registered",
        resource_type="apps.payments.payment",
    )
    client = APIClient()
    client.force_authenticate(actor)

    response = client.get(reverse("audit-list"), {"module": "analytics"})
    assert response.status_code == 200
    assert response.data["count"] == 1
    assert response.data["results"][0]["id"] == str(forecast_event.pk)

    exported = client.get(reverse("audit-export"), {"module": "analytics"})
    content = b"".join(exported.streaming_content).decode("utf-8")
    assert exported.status_code == 200
    assert "analytics.forecast.reject" in content
    assert "payment.registered" not in content


def test_module_filter_matches_label_lower_resource_types():
    actor = UserFactory(role=Role.ADMIN)
    order_event = AuditEvent.objects.create(
        actor=actor,
        action="order.status_changed",
        resource_type="orders.order",
    )
    AuditEvent.objects.create(
        actor=actor,
        action="payment.registered",
        resource_type="payments.payment",
    )
    client = APIClient()
    client.force_authenticate(actor)

    response = client.get(reverse("audit-list"), {"module": "orders"})

    assert response.status_code == 200
    assert [event["id"] for event in response.data["results"]] == [str(order_event.pk)]
