from decimal import Decimal

import pytest
from django.db import IntegrityError, transaction
from django.test import override_settings
from rest_framework.test import APIClient

from apps.accounts.factories import UserFactory
from apps.audit.models import AuditEvent
from common.constants import Role
from common.exceptions import DomainError

from .models import ProductionBatch, WasteDeclaration
from .services import create_batch, declare_waste, update_waste_declaration

pytestmark = pytest.mark.django_db


@pytest.fixture
def as_role():
    def authenticated_client(role):
        client = APIClient()
        client.force_authenticate(UserFactory(role=role))
        return client

    return authenticated_client


def make_batch(**overrides):
    values = {
        "product_name": "Soupe",
        "quantity_produced": Decimal("12.00"),
        "quantity_remaining": Decimal("12.00"),
        "unit_cost": Decimal("2.50"),
    }
    values.update(overrides)
    return ProductionBatch.objects.create(**values)


def declare(batch, actor, **overrides):
    values = {
        "remaining_quantity": Decimal("5.00"),
        "reusable_quantity": Decimal("2.00"),
        "discarded_quantity": Decimal("3.00"),
        "reason": "Fin de service",
    }
    values.update(overrides)
    return declare_waste(batch_id=batch.pk, actor=actor, **values)


def test_declare_waste_validates_partition_and_available_quantity():
    batch = make_batch(quantity_remaining=Decimal("3.00"))

    with pytest.raises(DomainError, match="quantité déclarée dépasse"):
        declare(batch, UserFactory())

    batch.refresh_from_db()
    assert batch.quantity_remaining == Decimal("3.00")
    assert WasteDeclaration.objects.count() == 0
    assert AuditEvent.objects.filter(action="production.waste.declare").count() == 0


def test_declaration_cost_is_snapshotted_and_unchanged_by_manager_edits():
    actor = UserFactory(role=Role.KITCHEN)
    manager = UserFactory(role=Role.MANAGER)
    batch = make_batch(unit_cost=Decimal("2.50"))

    declaration = declare(batch, actor)
    assert declaration.unit_cost_at_declaration == Decimal("2.50")
    assert declaration.estimated_cost == Decimal("7.50")
    batch.refresh_from_db()
    assert batch.quantity_remaining == Decimal("9.00")

    batch.unit_cost = Decimal("8.00")
    batch.save(update_fields=["unit_cost", "updated_at"])
    declaration = update_waste_declaration(
        declaration_id=declaration.pk,
        changes={
            "remaining_quantity": Decimal("4.00"),
            "reusable_quantity": Decimal("1.00"),
            "discarded_quantity": Decimal("3.00"),
            "reason": "Vérification manager",
        },
        actor=manager,
    )

    assert declaration.unit_cost_at_declaration == Decimal("2.50")
    assert declaration.estimated_cost == Decimal("7.50")
    assert declaration.reason == "Vérification manager"
    batch.refresh_from_db()
    assert batch.quantity_remaining == Decimal("9.00")
    assert AuditEvent.objects.filter(action="production.waste.update").count() == 1


def test_database_constraints_enforce_partition_and_batch_quantities():
    batch = make_batch()
    with pytest.raises(IntegrityError), transaction.atomic():
        WasteDeclaration.objects.create(
            batch=batch,
            remaining_quantity=Decimal("5.00"),
            reusable_quantity=Decimal("2.00"),
            discarded_quantity=Decimal("2.00"),
            reason="Incohérent",
            unit_cost_at_declaration=Decimal("2.50"),
            estimated_cost=Decimal("5.00"),
        )

    with pytest.raises(IntegrityError), transaction.atomic():
        ProductionBatch.objects.create(
            product_name="Invalid",
            quantity_produced=Decimal("3.00"),
            quantity_remaining=Decimal("4.00"),
            unit_cost=Decimal("1.00"),
        )


@override_settings(ROOT_URLCONF="apps.production.urls")
def test_invalid_partition_is_rejected_without_changing_batch(as_role):
    batch = make_batch()
    response = as_role(Role.KITCHEN).post(
        "/waste-declarations/",
        {
            "batch": str(batch.pk),
            "remaining_quantity": "5.00",
            "reusable_quantity": "2.00",
            "discarded_quantity": "2.00",
            "reason": "Fin de service",
        },
        format="json",
    )
    assert response.status_code == 400
    batch.refresh_from_db()
    assert batch.quantity_remaining == Decimal("12.00")
    assert WasteDeclaration.objects.count() == 0


@override_settings(ROOT_URLCONF="apps.production.urls")
def test_kitchen_can_declare_but_cannot_change_sensitive_fields(as_role):
    batch = make_batch()
    client = as_role(Role.KITCHEN)

    response = client.post(
        "/waste-declarations/",
        {
            "batch": str(batch.pk),
            "remaining_quantity": "5.00",
            "reusable_quantity": "2.00",
            "discarded_quantity": "3.00",
            "reason": "Fin de service",
        },
        format="json",
    )
    assert response.status_code == 201
    assert "estimated_cost" not in response.json()

    declaration = WasteDeclaration.objects.get()
    response = client.patch(
        f"/waste-declarations/{declaration.pk}/",
        {"reason": "Correction"},
        format="json",
    )
    assert response.status_code == 403

    response = client.post(
        "/production-batches/",
        {
            "product_name": "Salade",
            "quantity_produced": "5.00",
            "unit_cost": "3.00",
        },
        format="json",
    )
    assert response.status_code == 403


@override_settings(ROOT_URLCONF="apps.production.urls")
def test_manager_can_create_and_edit_production_and_waste(as_role):
    client = as_role(Role.MANAGER)
    response = client.post(
        "/production-batches/",
        {
            "product_name": "Tarte",
            "quantity_produced": "10.00",
            "unit_cost": "4.25",
        },
        format="json",
    )
    assert response.status_code == 201
    batch_id = response.json()["id"]

    response = client.post(
        "/waste-declarations/",
        {
            "batch": batch_id,
            "remaining_quantity": "3.00",
            "reusable_quantity": "1.00",
            "discarded_quantity": "2.00",
            "reason": "Invendu",
        },
        format="json",
    )
    assert response.status_code == 201
    declaration_id = response.json()["id"]
    assert response.json()["estimated_cost"] == "8.50"

    response = client.patch(
        f"/waste-declarations/{declaration_id}/",
        {
            "remaining_quantity": "2.00",
            "reusable_quantity": "1.00",
            "discarded_quantity": "1.00",
            "reason": "Corrigé par responsable",
        },
        format="json",
    )
    assert response.status_code == 200
    assert response.json()["estimated_cost"] == "8.50"
    assert response.json()["reason"] == "Corrigé par responsable"


def test_create_batch_requires_authenticated_actor():
    with pytest.raises(DomainError, match="authentifié"):
        create_batch(
            product_name="Soupe",
            quantity_produced=Decimal("1.00"),
            unit_cost=Decimal("1.00"),
            actor=None,
        )
