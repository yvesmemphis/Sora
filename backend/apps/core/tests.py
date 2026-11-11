import pytest
from django.core.management import call_command
from django.test import override_settings
from django.urls import reverse

from apps.audit.models import AuditEvent
from apps.core.models import RestaurantSettings
from common.constants import ALL_ROLES, Role

pytestmark = pytest.mark.django_db


def test_all_roles_can_read_settings(as_role):
    RestaurantSettings.load()

    for role in ALL_ROLES:
        response = as_role(role).get(reverse("settings"))
        assert response.status_code == 200


def test_only_admin_can_update_and_change_is_audited(as_role):
    settings = RestaurantSettings.load()
    response = as_role(Role.MANAGER).patch(
        reverse("settings"), {"name": "Autre nom"}, format="json"
    )
    assert response.status_code == 403

    response = as_role(Role.ADMIN).patch(
        reverse("settings"), {"name": "Bistro"}, format="json"
    )
    settings.refresh_from_db()
    assert response.status_code == 200
    assert settings.name == "Bistro"
    assert AuditEvent.objects.filter(action="settings.change").exists()


@pytest.mark.django_db
@override_settings(DEBUG=True)
def test_seed_demo_is_idempotent(monkeypatch):
    from apps.orders.models import Order

    monkeypatch.setenv("DEMO_PASSWORD", "Demo-Password-123!")
    call_command("seed_demo")
    initial_order_count = Order.objects.count()
    call_command("seed_demo")

    assert initial_order_count == 6
    assert Order.objects.count() == initial_order_count
