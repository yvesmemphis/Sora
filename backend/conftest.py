import pytest
from django.core.cache import cache
from rest_framework.test import APIClient

from apps.accounts.factories import UserFactory


@pytest.fixture(autouse=True)
def clear_cache():
    cache.clear()
    yield
    cache.clear()


def client_for(user):
    client = APIClient()
    client.force_authenticate(user)
    return client


@pytest.fixture
def as_role(db):
    return lambda role: client_for(UserFactory(role=role))
