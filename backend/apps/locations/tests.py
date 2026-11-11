import pytest
from django.urls import reverse

from apps.locations.models import Location
from common.constants import LocationType, Role

pytestmark = pytest.mark.django_db


def test_managers_manage_locations_and_staff_can_read(as_role):
    manager = as_role(Role.MANAGER)
    response = manager.post(
        reverse("locations:location-list"),
        {"type": LocationType.TABLE, "reference": "T12"},
        format="json",
    )
    assert response.status_code == 201
    assert (
        as_role(Role.WAITER).get(reverse("locations:location-list")).status_code == 200
    )
    assert Location.objects.filter(type=LocationType.TABLE, reference="T12").exists()


def test_waiter_cannot_create_location(as_role):
    response = as_role(Role.WAITER).post(
        reverse("locations:location-list"),
        {"type": LocationType.TABLE, "reference": "T13"},
        format="json",
    )
    assert response.status_code == 403
