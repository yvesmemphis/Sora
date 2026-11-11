import factory
from factory.django import DjangoModelFactory

from .models import Category, Dish


class CategoryFactory(DjangoModelFactory):
    class Meta:
        model = Category

    name = factory.Sequence(lambda number: f"Catégorie {number}")


class DishFactory(DjangoModelFactory):
    class Meta:
        model = Dish

    category = factory.SubFactory(CategoryFactory)
    name = factory.Sequence(lambda number: f"Plat {number}")
    price = "10.00"
