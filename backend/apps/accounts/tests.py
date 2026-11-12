
import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from apps.accounts.factories import UserFactory
from apps.accounts.serializers import StaffSerializer
from common.constants import Role

pytestmark = pytest.mark.django_db


def test_staff_serializer_exposes_invitation_status():
    invited = get_user_model().objects.create_user(
        email="invited@example.com",
        role=Role.WAITER,
    )

    assert StaffSerializer(invited).data["is_invited"] is True
    invited.set_password("Str0ng-Pass-123!")
    assert StaffSerializer(invited).data["is_invited"] is False


def test_admin_can_resend_invitation(monkeypatch):
    from apps.accounts import services

    invited = get_user_model().objects.create_user(
        email="pending@example.com",
        role=Role.WAITER,
    )
    admin = UserFactory(role=Role.ADMIN)
    sent = []
    monkeypatch.setattr(
        services,
        "send_password_email",
        lambda *args, **kwargs: sent.append(args[0].pk),
    )
    monkeypatch.setattr(
        services.transaction,
        "on_commit",
        lambda callback: callback(),
    )
    client = APIClient()
    client.force_authenticate(admin)

    response = client.post(f"/api/v1/staff/{invited.pk}/resend-invitation/")

    assert response.status_code == 202
    assert response.data["is_invited"] is True
    assert sent == [invited.pk]


def test_staff_invitation_cannot_be_resent_after_password_is_set():
    invited = get_user_model().objects.create_user(
        email="active@example.com",
        password="Str0ng-Pass-123!",
        role=Role.WAITER,
    )
    client = APIClient()
    client.force_authenticate(UserFactory(role=Role.ADMIN))

    response = client.post(f"/api/v1/staff/{invited.pk}/resend-invitation/")

    assert response.status_code == 409
