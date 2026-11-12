import pytest
from django.urls import reverse
from rest_framework.test import APIClient

from apps.accounts.factories import UserFactory

pytestmark = pytest.mark.django_db


def test_login_uses_same_error_for_unknown_or_wrong_password():
    user = UserFactory()
    client = APIClient()
    success = client.post(
        reverse("login"),
        {"email": user.email, "password": "Str0ng-Pass-123!"},
    )
    wrong_password = client.post(
        reverse("login"),
        {"email": user.email, "password": "mauvais"},
    )
    unknown_user = client.post(
        reverse("login"),
        {"email": "x@example.com", "password": "mauvais"},
    )

    assert success.status_code == 200
    assert wrong_password.status_code == unknown_user.status_code == 401
    assert wrong_password.json() == unknown_user.json()


def test_login_updates_last_login():
    user = UserFactory()
    assert user.last_login is None

    response = APIClient().post(
        reverse("login"),
        {"email": user.email, "password": "Str0ng-Pass-123!"},
    )

    assert response.status_code == 200
    assert "refresh" not in response.data
    cookie = response.cookies["sora_refresh"]
    assert cookie["httponly"]
    user.refresh_from_db()
    assert user.last_login is not None


def test_sixth_login_attempt_is_throttled():
    client = APIClient()
    for _ in range(5):
        client.post(reverse("login"), {"email": "a@example.com", "password": "x"})

    response = client.post(
        reverse("login"), {"email": "a@example.com", "password": "x"}
    )
    assert response.status_code == 429


def test_refresh_is_refused_after_logout():
    user = UserFactory()
    client = APIClient()
    login = client.post(
        reverse("login"),
        {"email": user.email, "password": "Str0ng-Pass-123!"},
    )
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {login.data['access']}")

    assert client.post(reverse("logout")).status_code == 204
    assert client.post(reverse("refresh")).status_code == 401


def test_refresh_rotates_http_only_cookie_without_returning_refresh_token():
    user = UserFactory()
    client = APIClient()
    login = client.post(
        reverse("login"),
        {"email": user.email, "password": "Str0ng-Pass-123!"},
    )

    refreshed = client.post(reverse("refresh"))

    assert login.status_code == 200
    assert refreshed.status_code == 200
    assert "refresh" not in refreshed.data
    assert refreshed.cookies["sora_refresh"]["httponly"]


def test_cookie_refresh_requires_csrf_header():
    user = UserFactory()
    client = APIClient(enforce_csrf_checks=True)
    login = client.post(
        reverse("login"),
        {"email": user.email, "password": "Str0ng-Pass-123!"},
    )

    rejected = client.post(reverse("refresh"))
    csrf_token = client.cookies["csrftoken"].value
    accepted = client.post(
        reverse("refresh"),
        HTTP_X_CSRFTOKEN=csrf_token,
    )
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {login.data['access']}")
    rejected_logout = client.post(reverse("logout"))
    accepted_logout = client.post(
        reverse("logout"),
        HTTP_X_CSRFTOKEN=csrf_token,
    )

    assert login.status_code == 200
    assert rejected.status_code == 403
    assert accepted.status_code == 200
    assert rejected_logout.status_code == 403
    assert accepted_logout.status_code == 204


def test_password_reset_request_does_not_reveal_unknown_account():
    response = APIClient().post(
        reverse("password-reset"), {"email": "nobody@example.com"}
    )
    assert response.status_code == 202


def test_disabled_account_is_rejected_with_existing_access_token():
    user = UserFactory()
    client = APIClient()
    tokens = client.post(
        reverse("login"),
        {"email": user.email, "password": "Str0ng-Pass-123!"},
    ).json()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {tokens['access']}")
    assert client.get(reverse("me")).status_code == 200

    user.is_active = False
    user.save(update_fields=["is_active"])
    assert client.get(reverse("me")).status_code == 401
