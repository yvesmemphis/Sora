import pytest
from django.urls import reverse
from rest_framework.test import APIClient

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
        "preparation_time",
    }
    assert dishes[0]["is_available"] is False
    assert dishes[1]["is_available"] is True
    assert dishes[1]["preparation_time"] == 15
