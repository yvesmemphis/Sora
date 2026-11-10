import factory
from django.contrib.auth import get_user_model
from django.contrib.auth.hashers import make_password

from common.constants import Role


class UserFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = get_user_model()

    email = factory.Sequence(lambda number: f"user{number}@example.com")
    role = Role.WAITER
    password = factory.LazyFunction(lambda: make_password("Str0ng-Pass-123!"))
