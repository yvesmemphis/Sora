from decimal import Decimal
from typing import ClassVar

from django.core.validators import MinValueValidator
from django.db import models
from django.utils import timezone

from common.models import BaseModel


class ProductionBatch(BaseModel):
    """A dated product-name snapshot; Menu has no product model to reference yet."""

    product_name = models.CharField(max_length=120)
    production_date = models.DateField(default=timezone.localdate, db_index=True)
    quantity_produced = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0.01"))],
    )
    quantity_remaining = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        validators=[MinValueValidator(0)],
    )
    unit_cost = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        validators=[MinValueValidator(0)],
        help_text="Coût unitaire du lot au moment de sa création.",
    )
    notes = models.TextField(blank=True)

    class Meta:
        ordering: ClassVar = ["-production_date", "-created_at"]
        constraints: ClassVar = [
            models.CheckConstraint(
                condition=models.Q(quantity_produced__gt=0),
                name="prod_batch_produced_gt0",
            ),
            models.CheckConstraint(
                condition=models.Q(quantity_remaining__gte=0),
                name="prod_batch_remaining_gte0",
            ),
            models.CheckConstraint(
                condition=models.Q(
                    quantity_remaining__lte=models.F("quantity_produced")
                ),
                name="prod_batch_remaining_lte_produced",
            ),
            models.CheckConstraint(
                condition=models.Q(unit_cost__gte=0),
                name="prod_batch_cost_gte0",
            ),
        ]

    def __str__(self):
        return f"{self.product_name} ({self.production_date})"


class WasteDeclaration(BaseModel):
    """Partition unsold quantity; costs and reusable quantities are audit records."""

    batch = models.ForeignKey(
        ProductionBatch,
        on_delete=models.PROTECT,
        related_name="waste_declarations",
    )
    remaining_quantity = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0.01"))],
    )
    reusable_quantity = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        validators=[MinValueValidator(0)],
    )
    discarded_quantity = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        validators=[MinValueValidator(0)],
    )
    reason = models.CharField(max_length=250)
    unit_cost_at_declaration = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        validators=[MinValueValidator(0)],
    )
    estimated_cost = models.DecimalField(
        max_digits=24,
        decimal_places=2,
        validators=[MinValueValidator(0)],
    )
    declared_at = models.DateTimeField(default=timezone.now, db_index=True)

    class Meta:
        ordering: ClassVar = ["-declared_at"]
        constraints: ClassVar = [
            models.CheckConstraint(
                condition=models.Q(remaining_quantity__gt=0),
                name="prod_waste_remaining_gt0",
            ),
            models.CheckConstraint(
                condition=models.Q(reusable_quantity__gte=0),
                name="prod_waste_reusable_gte0",
            ),
            models.CheckConstraint(
                condition=models.Q(discarded_quantity__gte=0),
                name="prod_waste_discarded_gte0",
            ),
            models.CheckConstraint(
                condition=models.Q(
                    remaining_quantity=models.F("reusable_quantity")
                    + models.F("discarded_quantity")
                ),
                name="prod_waste_partition_eq",
            ),
            models.CheckConstraint(
                condition=models.Q(unit_cost_at_declaration__gte=0),
                name="prod_waste_unit_cost_gte0",
            ),
            models.CheckConstraint(
                condition=models.Q(estimated_cost__gte=0),
                name="prod_waste_estimated_cost_gte0",
            ),
        ]

    @property
    def declared_by(self):
        return self.created_by

    def __str__(self):
        return f"{self.batch}: {self.discarded_quantity} discarded"
