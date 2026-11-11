import pytest
from django.urls import reverse

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
