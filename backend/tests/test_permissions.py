import pytest
from django.urls import reverse

from common.constants import Role

CASES = [
    ("settings", "get", Role.KITCHEN, 200),
    ("settings", "patch", Role.MANAGER, 403),
    ("menu:category-list", "get", Role.KITCHEN, 200),
    ("menu:category-list", "post", Role.KITCHEN, 403),
    ("menu:category-list", "post", Role.MANAGER, 400),
    ("locations:location-list", "post", Role.WAITER, 403),
    ("locations:location-list", "get", Role.WAITER, 200),
    ("audit-list", "get", Role.MANAGER, 403),
    ("audit-list", "get", Role.ADMIN, 200),
]


@pytest.mark.django_db
@pytest.mark.parametrize("name,method,role,expected", CASES)
def test_role_matrix(as_role, name, method, role, expected):
    response = getattr(as_role(role), method)(reverse(name), {}, format="json")
    assert response.status_code == expected


@pytest.mark.django_db
@pytest.mark.parametrize(
    "name",
    [
        "settings",
        "audit-list",
        "menu:dish-list",
        "locations:location-list",
        "orders:order-list",
    ],
)
def test_anonymous_is_rejected_from_private_endpoints(name):
    from rest_framework.test import APIClient

    assert APIClient().get(reverse(name)).status_code == 401
