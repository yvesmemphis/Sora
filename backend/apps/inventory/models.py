
# Modèles d'inventaire (Dev 2).

import uuid
from decimal import Decimal, ROUND_HALF_UP

from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.validators import MinValueValidator
from django.db import models
from django.utils import timezone

from common.models import AppendOnlyModel, BaseModel


def validate_positive_quantity(value):
    """Validateur que la quantité soit stricto sensu positive."""
    if value <= 0:
        raise ValidationError("La quantité doit être stricto sensu positive (supérieure à 0).")


def generate_lot_id():
    return f"LOT-{uuid.uuid4().hex}"


class Supplier(BaseModel):
    """Fournisseur d'ingrédients."""

    name = models.CharField(max_length=120, unique=True)
    contact_name = models.CharField(max_length=100, null=True, blank=True)
    email = models.EmailField(max_length=120, null=True, blank=True)
    phone = models.CharField(max_length=30, null=True, blank=True)
    address = models.TextField(null=True, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["name"]
        verbose_name = "Fournisseur"
        verbose_name_plural = "Fournisseurs"

    def __str__(self):
        return self.name


class Ingredient(BaseModel):
    """Ingrédient de base (viande, légumes, épices, etc.)."""

    name = models.CharField(max_length=120, unique=True)
    description = models.TextField(null=True, blank=True)
    unit_of_measure = models.CharField(
        max_length=20,
        choices=[
            ("KG", "Kilogramme"),
            ("GR", "Gramme"),
            ("L", "Litre"),
            ("UN", "Unité"),
            ("CS", "Carton"),
        ],
        default="UN"
    )
    minimum_stock = models.DecimalField(
        max_digits=10,
        decimal_places=3,
        default=0,
        validators=[MinValueValidator(0)],
        help_text="Stock minimum alerte"
    )
    maximum_stock = models.DecimalField(
        max_digits=10,
        decimal_places=3,
        default=0,
        validators=[MinValueValidator(0)],
        help_text="Stock maximum (pour éviter le stockage excessif)"
    )
    supplier = models.ForeignKey(
        Supplier, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="ingredients"
    )
    is_active = models.BooleanField(default=True)
    cost_per_unit = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0,
        validators=[MinValueValidator(0)],
        help_text="Coût d'achat moyen actuel"
    )

    class Meta:
        ordering = ["name"]
        verbose_name = "Ingrédient"
        verbose_name_plural = "Ingrédients"

    def __str__(self):
        return self.name

    def get_current_stock_value(self):
        """Valeur totale du stock actuel de cet ingrédient."""
        value = self.stock_lots.aggregate(
            total=models.Sum(
                models.F("quantity_remaining") * models.F("cost_per_unit")
            )
        )["total"]
        return value if value is not None else Decimal(0)


class StockLot(BaseModel):
    """Lot d'achat en stock avec numéro de lot, date péremption, etc."""

    lot_id = models.CharField(
        max_length=36, unique=True, default=generate_lot_id,
        help_text="Identifiant unique du lot"
    )
    ingredient = models.ForeignKey(
        Ingredient, on_delete=models.PROTECT, related_name="stock_lots"
    )
    supplier = models.ForeignKey(
        Supplier,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="stock_lots",
    )
    quantity_received = models.DecimalField(
        max_digits=12,
        decimal_places=3,
        validators=[validate_positive_quantity],
        help_text="Quantité reçue dans ce lot"
    )
    quantity_remaining = models.DecimalField(
        max_digits=12,
        decimal_places=3,
        validators=[MinValueValidator(0)],
        help_text="Quantité encore disponible"
    )
    date_received = models.DateField()
    date_expiration = models.DateField(db_index=True)
    cost_per_unit = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(0)],
        help_text="Coût unitaire au moment de la réception"
    )
    country_of_origin = models.CharField(
        max_length=100, null=True, blank=True
    )
    is_active = models.BooleanField(default=True)
    class Meta:
        ordering = ["date_expiration"]
        verbose_name = "Lot de stock"
        verbose_name_plural = "Lots de stock"
        indexes = [
            models.Index(
                fields=["ingredient", "date_expiration", "date_received"],
                name="inventory_lot_fefo_idx",
            )
        ]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(quantity_received__gt=0),
                name="inv_lot_received_gt0",
            ),
            models.CheckConstraint(
                condition=models.Q(quantity_remaining__gte=0),
                name="inv_lot_remain_gte0",
            ),
            models.CheckConstraint(
                condition=models.Q(quantity_remaining__lte=models.F("quantity_received")),
                name="inv_lot_remain_lte_received",
            ),
            models.CheckConstraint(
                condition=models.Q(cost_per_unit__gte=0),
                name="inv_lot_cost_gte0",
            ),
            models.CheckConstraint(
                condition=models.Q(date_expiration__gte=models.F("date_received")),
                name="inv_lot_expiry_after_received",
            ),
        ]

    def __str__(self):
        return f"Lot {self.lot_id} - {self.ingredient.name}"

    @property
    def is_expired(self):
        """Vérifier si le lot est périmé."""
        from django.utils import timezone
        return timezone.now().date() > self.date_expiration

    @property
    def days_until_expiration(self):
        """Nombre de jours avant expiration."""
        from django.utils import timezone
        delta = self.date_expiration - timezone.now().date()
        return delta.days


class StockMovement(AppendOnlyModel):
    """Mouvement de stock (entrées, sorties, ajustements, pertes)."""

    MOVEMENT_TYPE_CHOICES = [
        ("IN", "Entrée (réception lot)"),
        ("OUT", "Sortie (consommation)"),
        ("ADJ", "Ajustement physique"),
        ("WST", "Déclaration perte"),
    ]

    lot = models.ForeignKey(
        StockLot, on_delete=models.PROTECT, related_name="movements"
    )
    movement_type = models.CharField(
        max_length=3, choices=MOVEMENT_TYPE_CHOICES
    )
    quantity = models.DecimalField(
        max_digits=12,
        decimal_places=3,
        validators=[validate_positive_quantity],
        help_text="Quantité du mouvement (toujours positive)"
    )
    unit_cost = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0,
        validators=[MinValueValidator(0)],
        help_text="Coût unitaire au moment du mouvement"
    )
    total_cost = models.DecimalField(
        max_digits=24,
        decimal_places=2,
        default=0,
        validators=[MinValueValidator(0)],
        help_text="Coût total du mouvement"
    )
    reference_order = models.ForeignKey(
        "orders.Order", on_delete=models.PROTECT, null=True, blank=True,
        related_name="stock_movements"
    )
    noted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True
    )
    notes = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Mouvement de stock"
        verbose_name_plural = "Mouvements de stock"
        indexes = [models.Index(fields=["lot", "created_at"])]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(quantity__gt=0),
                name="inv_move_qty_gt0",
            ),
            models.CheckConstraint(
                condition=models.Q(unit_cost__gte=0),
                name="inv_move_unit_cost_gte0",
            ),
            models.CheckConstraint(
                condition=models.Q(total_cost__gte=0),
                name="inv_move_total_cost_gte0",
            ),
        ]

    def __str__(self):
        return f"{self.get_movement_type_display()} - {self.lot.ingredient.name} x{self.quantity}"

    def save(self, *args, **kwargs):
        """Calculer le coût total avant sauvegarde."""
        self.total_cost = (self.quantity * self.unit_cost).quantize(
            Decimal("0.01"),
            rounding=ROUND_HALF_UP,
        )
        super().save(*args, **kwargs)


class InventoryAlert(BaseModel):
    class Type(models.TextChoices):
        LOW_STOCK = "LOW_STOCK", "Stock bas"
        OVERSTOCK = "OVERSTOCK", "Surstock"
        EXPIRING = "EXPIRING", "Péremption proche"

    ingredient = models.ForeignKey(
        Ingredient, on_delete=models.PROTECT, related_name="alerts"
    )
    stock_lot = models.ForeignKey(
        StockLot,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="alerts",
    )
    alert_type = models.CharField(max_length=12, choices=Type.choices)
    message = models.CharField(max_length=240)
    is_resolved = models.BooleanField(default=False)
    resolved_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["is_resolved", "alert_type"]),
            models.Index(fields=["ingredient", "is_resolved"]),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["ingredient", "alert_type"],
                condition=models.Q(
                    is_resolved=False,
                    alert_type__in=["LOW_STOCK", "OVERSTOCK"],
                ),
                name="inv_active_threshold_alert",
            ),
            models.UniqueConstraint(
                fields=["stock_lot", "alert_type"],
                condition=models.Q(
                    is_resolved=False,
                    alert_type="EXPIRING",
                    stock_lot__isnull=False,
                ),
                name="inv_active_expiring_alert",
            ),
        ]

    def resolve(self):
        if not self.is_resolved:
            self.is_resolved = True
            self.resolved_at = timezone.now()
            self.save(update_fields=["is_resolved", "resolved_at", "updated_at"])


class RecipeVersion(BaseModel):
    name = models.CharField(max_length=160)
    menu_item_id = models.CharField(max_length=50, null=True, blank=True, db_index=True)
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    version_number = models.PositiveIntegerField()
    valid_from = models.DateTimeField(default=timezone.now)
    valid_until = models.DateTimeField(null=True, blank=True)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ["name", "-version_number"]
        constraints = [
            models.UniqueConstraint(
                fields=["name", "version_number"],
                name="inv_recipe_name_version_uq",
            ),
            models.UniqueConstraint(
                fields=["menu_item_id"],
                condition=models.Q(is_active=True, menu_item_id__isnull=False),
                name="inv_recipe_one_active_per_dish",
            ),
            models.CheckConstraint(
                condition=models.Q(version_number__gt=0),
                name="inv_recipe_version_gt0",
            ),
            models.CheckConstraint(
                condition=(
                    models.Q(valid_until__isnull=True)
                    | models.Q(valid_until__gt=models.F("valid_from"))
                ),
                name="inv_recipe_valid_period",
            ),
        ]

    def __str__(self):
        return f"{self.name} v{self.version_number}"


class RecipeItem(BaseModel):
    recipe_version = models.ForeignKey(
        RecipeVersion, on_delete=models.PROTECT, related_name="items"
    )
    ingredient = models.ForeignKey(
        Ingredient, on_delete=models.PROTECT, related_name="recipe_items"
    )
    quantity_required = models.DecimalField(
        max_digits=12,
        decimal_places=3,
        validators=[MinValueValidator(Decimal("0.001"))],
    )
    is_required = models.BooleanField(default=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["recipe_version", "ingredient"],
                name="inv_recipe_item_uq",
            ),
            models.CheckConstraint(
                condition=models.Q(quantity_required__gt=0),
                name="inv_recipe_item_qty_gt0",
            ),
        ]

    def __str__(self):
        return f"{self.ingredient.name}: {self.quantity_required}"


class RecipeConsumption(BaseModel):
    recipe_version = models.ForeignKey(
        RecipeVersion, on_delete=models.PROTECT, related_name="consumptions"
    )
    order = models.ForeignKey(
        "orders.Order", on_delete=models.PROTECT, related_name="recipe_consumptions"
    )
    recipe_item = models.ForeignKey(
        RecipeItem,
        on_delete=models.PROTECT,
        related_name="consumptions",
        null=True,
        blank=True,
    )
    consumed_at = models.DateTimeField(auto_now_add=True)
    quantity_consumed_per_item = models.DecimalField(
        max_digits=12,
        decimal_places=3,
        validators=[MinValueValidator(0)],
    )
    stock_remaining_after = models.DecimalField(
        max_digits=12,
        decimal_places=3,
        null=True,
        blank=True,
        validators=[MinValueValidator(0)],
    )
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ["-consumed_at"]
        indexes = [models.Index(fields=["order", "consumed_at"])]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(quantity_consumed_per_item__gt=0),
                name="inv_recipe_consume_gt0",
            ),
            models.CheckConstraint(
                condition=(
                    models.Q(stock_remaining_after__isnull=True)
                    | models.Q(stock_remaining_after__gte=0)
                ),
                name="inv_recipe_remaining_gte0",
            ),
            models.UniqueConstraint(
                fields=["order", "recipe_item"],
                condition=models.Q(recipe_item__isnull=False),
                name="inv_order_recipe_item_once",
            ),
        ]
