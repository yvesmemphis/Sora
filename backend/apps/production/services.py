from decimal import ROUND_HALF_UP, Decimal, InvalidOperation

from django.db import transaction
from django.utils import timezone

from apps.audit import services as audit
from common.exceptions import DomainError

from .models import ProductionBatch, WasteDeclaration

ZERO = Decimal(0)
CENT = Decimal("0.01")


def _amount(value, field, *, positive=False):
    try:
        amount = Decimal(value)
    except (InvalidOperation, TypeError, ValueError):
        raise DomainError("invalid_amount", f"{field} invalide.", 400) from None
    try:
        normalized = amount.quantize(CENT)
    except InvalidOperation:
        raise DomainError("invalid_amount", f"{field} invalide.", 400) from None
    if not amount.is_finite() or normalized != amount:
        raise DomainError(
            "invalid_amount",
            f"{field} doit avoir au plus deux décimales.",
            400,
        )
    if amount < ZERO or (positive and amount == ZERO):
        raise DomainError(
            "invalid_amount",
            f"{field} doit être strictement positif."
            if positive
            else f"{field} ne peut pas être négatif.",
            400,
        )
    return amount


def _reason(value):
    reason = (value or "").strip()
    if not reason:
        raise DomainError("reason_required", "Un motif est obligatoire.", 400)
    return reason[:250]


def _validate_partition(remaining, reusable, discarded):
    if remaining != reusable + discarded:
        raise DomainError(
            "invalid_partition",
            "La quantité restante doit être égale aux quantités réutilisable et jetée.",
            400,
        )


def _require_actor(actor):
    if actor is None:
        raise DomainError("actor_required", "Un utilisateur authentifié est requis.", 400)


@transaction.atomic
def create_batch(
    *,
    product_name,
    quantity_produced,
    unit_cost,
    actor,
    production_date=None,
    notes="",
):
    _require_actor(actor)
    product_name = (product_name or "").strip()
    if not product_name:
        raise DomainError("product_required", "Le nom du produit est obligatoire.", 400)
    quantity = _amount(quantity_produced, "La quantité produite", positive=True)
    cost = _amount(unit_cost, "Le coût unitaire")
    batch = ProductionBatch.objects.create(
        product_name=product_name,
        production_date=production_date or timezone.localdate(),
        quantity_produced=quantity,
        quantity_remaining=quantity,
        unit_cost=cost,
        notes=notes or "",
        created_by=actor,
    )
    audit.log(
        actor=actor,
        action="production.batch.create",
        resource=batch,
        metadata={
            "product_name": product_name,
            "quantity_produced": str(quantity),
            "unit_cost": str(cost),
        },
    )
    return batch


@transaction.atomic
def update_batch(*, batch_id, changes, actor):
    _require_actor(actor)
    batch = ProductionBatch.objects.select_for_update().get(pk=batch_id)
    allowed = {"product_name", "unit_cost", "production_date", "notes"}
    updates = {key: value for key, value in changes.items() if key in allowed}
    if "product_name" in updates:
        updates["product_name"] = updates["product_name"].strip()
        if not updates["product_name"]:
            raise DomainError("product_required", "Le nom du produit est obligatoire.", 400)
    if "unit_cost" in updates:
        updates["unit_cost"] = _amount(updates["unit_cost"], "Le coût unitaire")
    for field, value in updates.items():
        setattr(batch, field, value)
    if updates:
        batch.save(update_fields=[*updates, "updated_at"])
        audit.log(
            actor=actor,
            action="production.batch.update",
            resource=batch,
            metadata={key: str(value) for key, value in updates.items()},
        )
    return batch


@transaction.atomic
def declare_waste(
    *,
    batch_id,
    remaining_quantity,
    reusable_quantity,
    discarded_quantity,
    reason,
    actor,
):
    _require_actor(actor)
    batch = ProductionBatch.objects.select_for_update().get(pk=batch_id)
    remaining = _amount(remaining_quantity, "La quantité invendue", positive=True)
    reusable = _amount(reusable_quantity, "La quantité réutilisable")
    discarded = _amount(discarded_quantity, "La quantité jetée")
    _validate_partition(remaining, reusable, discarded)
    reason = _reason(reason)

    if remaining > batch.quantity_remaining:
        raise DomainError(
            "quantity_exceeded",
            "La quantité déclarée dépasse le reste disponible du lot.",
            400,
        )

    unit_cost = batch.unit_cost
    estimated_cost = (discarded * unit_cost).quantize(CENT, rounding=ROUND_HALF_UP)
    declaration = WasteDeclaration.objects.create(
        batch=batch,
        remaining_quantity=remaining,
        reusable_quantity=reusable,
        discarded_quantity=discarded,
        reason=reason,
        unit_cost_at_declaration=unit_cost,
        estimated_cost=estimated_cost,
        created_by=actor,
    )
    batch.quantity_remaining -= discarded
    batch.save(update_fields=["quantity_remaining", "updated_at"])
    audit.log(
        actor=actor,
        action="production.waste.declare",
        resource=declaration,
        metadata={
            "batch_id": str(batch.pk),
            "remaining_quantity": str(remaining),
            "reusable_quantity": str(reusable),
            "discarded_quantity": str(discarded),
            "estimated_cost": str(estimated_cost),
            "reason": reason,
        },
    )
    return declaration


@transaction.atomic
def update_waste_declaration(*, declaration_id, changes, actor):
    _require_actor(actor)
    declaration_ref = WasteDeclaration.objects.only("batch_id").get(pk=declaration_id)
    batch = ProductionBatch.objects.select_for_update().get(pk=declaration_ref.batch_id)
    declaration = WasteDeclaration.objects.select_for_update().get(pk=declaration_id)

    remaining = _amount(
        changes.get("remaining_quantity", declaration.remaining_quantity),
        "La quantité invendue",
        positive=True,
    )
    reusable = _amount(
        changes.get("reusable_quantity", declaration.reusable_quantity),
        "La quantité réutilisable",
    )
    discarded = _amount(
        changes.get("discarded_quantity", declaration.discarded_quantity),
        "La quantité jetée",
    )
    _validate_partition(remaining, reusable, discarded)
    reason = _reason(changes.get("reason", declaration.reason))

    new_batch_remaining = (
        batch.quantity_remaining + declaration.discarded_quantity - discarded
    )
    if new_batch_remaining < ZERO or new_batch_remaining > batch.quantity_produced:
        raise DomainError(
            "quantity_exceeded",
            "La modification dépasse les quantités disponibles du lot.",
            400,
        )

    old_values = {
        "remaining_quantity": str(declaration.remaining_quantity),
        "reusable_quantity": str(declaration.reusable_quantity),
        "discarded_quantity": str(declaration.discarded_quantity),
        "reason": declaration.reason,
    }
    declaration.remaining_quantity = remaining
    declaration.reusable_quantity = reusable
    declaration.discarded_quantity = discarded
    declaration.reason = reason
    declaration.save(
        update_fields=[
            "remaining_quantity",
            "reusable_quantity",
            "discarded_quantity",
            "reason",
            "updated_at",
        ]
    )
    batch.quantity_remaining = new_batch_remaining
    batch.save(update_fields=["quantity_remaining", "updated_at"])
    audit.log(
        actor=actor,
        action="production.waste.update",
        resource=declaration,
        metadata={
            "before": old_values,
            "after": {
                "remaining_quantity": str(remaining),
                "reusable_quantity": str(reusable),
                "discarded_quantity": str(discarded),
                "reason": reason,
            },
            "estimated_cost_unchanged": str(declaration.estimated_cost),
        },
    )
    return declaration
