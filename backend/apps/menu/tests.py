import pytest
from django.urls import reverse
from rest_framework.test import APIClient

from apps.accounts.factories import UserFactory
from apps.menu.factories import CategoryFactory, DishFactory
from common.constants import Role

pytestmark = pytest.mark.django_db


def test_kitchen_can_toggle_availability_but_cannot_change_price(as_role):
    dish = DishFactory(price="10.00")
    kitchen = as_role(Role.KITCHEN)

    response = kitchen.patch(
        reverse("menu:dish-detail", args=[dish.pk]),
        {"price": "1.00"},
        format="json",
    )
    assert response.status_code == 403

    response = kitchen.post(
        reverse("menu:dish-set-availability", args=[dish.pk]),
        {"is_available": False},
        format="json",
    )
    dish.refresh_from_db()
    assert response.status_code == 200
    assert not dish.is_available


def test_deleting_a_dish_only_unpublishes_it(as_role):
    dish = DishFactory()

    response = as_role(Role.MANAGER).delete(reverse("menu:dish-detail", args=[dish.pk]))
    dish.refresh_from_db()

    assert response.status_code == 204
    assert not dish.is_published
    assert not dish.is_available


def test_public_menu_exposes_published_dishes_and_availability_state():
    CategoryFactory()
    visible = DishFactory(name="Visible", preparation_time=15)
    DishFactory(name="Masqué", is_published=False)
    DishFactory(name="Indisponible", is_available=False)

    response = APIClient().get(reverse("menu:public-menu"))

    assert response.status_code == 200
    dishes = response.data["dishes"]
    assert [dish["name"] for dish in dishes] == ["Indisponible", visible.name]
    assert set(response.data["dishes"][0]) == {
        "id",
        "name",
        "description",
        "price",
        "allergens",
        "image",
        "category",
        "is_available",
        "availability_status",
        "preparation_time",
    }
    assert dishes[0]["is_available"] is False
    assert dishes[0]["availability_status"] == "TEMPORARILY_UNAVAILABLE"
    assert dishes[1]["is_available"] is True
    assert dishes[1]["preparation_time"] == 15


def test_kitchen_can_set_a_distinct_sold_out_state(as_role):
    dish = DishFactory()

    response = as_role(Role.KITCHEN).post(
        reverse("menu:dish-set-availability", args=[dish.pk]),
        {"availability_status": "SOLD_OUT"},
        format="json",
    )

    dish.refresh_from_db()
    assert response.status_code == 200
    assert response.data["is_available"] is False
    assert response.data["availability_status"] == "SOLD_OUT"
    assert dish.is_available is False


def test_dish_availability_fields_must_be_consistent(as_role):
    dish = DishFactory()

    response = as_role(Role.MANAGER).patch(
        reverse("menu:dish-detail", args=[dish.pk]),
        {
            "is_available": True,
            "availability_status": "SOLD_OUT",
        },
        format="json",
    )

    assert response.status_code == 400


def test_public_menu_returns_configured_withdrawal_delay_and_payment_methods():
    from apps.core.models import RestaurantSettings

    settings = RestaurantSettings.load()
    settings.withdrawal_delay_minutes = 12
    settings.accepted_payment_methods = ["cash", "card"]
    settings.currency = "EUR"
    settings.opening_hours = {"monday": {"open": "09:00", "close": "18:00"}}
    settings.save()

    response = APIClient().get(reverse("menu:public-menu"))

    assert response.status_code == 200
    assert response.data["withdrawal_delay_minutes"] == 12
    assert response.data["accepted_payment_methods"] == ["cash", "card"]
    assert response.data["currency"] == "EUR"
    assert response.data["opening_hours"]["monday"]["open"] == "09:00"


def test_settings_reject_invalid_hours_and_empty_payment_methods(as_role):
    client = as_role(Role.ADMIN)

    bad_hours = client.patch(
        "/api/v1/settings/",
        {"opening_hours": {"monday": {"open": "9am", "close": "18:00"}}},
        format="json",
    )
    no_methods = client.patch(
        "/api/v1/settings/",
        {"accepted_payment_methods": []},
        format="json",
    )

    assert bad_hours.status_code == 400
    assert no_methods.status_code == 400


def test_manager_can_download_public_menu_qr_code():
    client = APIClient()
    client.force_authenticate(UserFactory(role=Role.MANAGER))

    response = client.get("/api/v1/public/menu/qr/")

    assert response.status_code == 200
    assert response["Content-Type"] == "image/png"
    assert response.content.startswith(b"\x89PNG\r\n\x1a\n")
    assert "menu_api=" in response["X-QR-Target"]
