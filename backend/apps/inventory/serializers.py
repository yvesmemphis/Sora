# serializers.py pour l'app Inventory (Dev 2)

from decimal import Decimal

from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from .models import (
    Ingredient,
    InventoryAlert,
    RecipeConsumption,
    RecipeItem,
    RecipeVersion,
    StockLot,
    StockMovement,
    Supplier,
)


class SupplierSerializer(serializers.ModelSerializer):
    """Sérialiseur pour le modèle Supplier."""

    class Meta:
        model = Supplier
        fields = [
            "id", "name", "contact_name", "email", "phone",
            "address", "is_active", "created_at", "updated_at"
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class IngredientSerializer(serializers.ModelSerializer):
    """Sérialiseur pour le modèle Ingredient."""

    supplier_name = serializers.CharField(
        source="supplier.name", read_only=True
    )

    class Meta:
        model = Ingredient
        fields = [
            "id", "name", "description", "unit_of_measure",
            "minimum_stock", "maximum_stock", "supplier", "supplier_name",
            "is_active", "cost_per_unit", "created_at", "updated_at"
        ]
        read_only_fields = ["id", "cost_per_unit", "created_at", "updated_at"]


class IngredientStaffSerializer(serializers.ModelSerializer):
        supplier_name = serializers.CharField(
            source="supplier.name", read_only=True, allow_null=True
        )

        class Meta:
            model = Ingredient
            fields = [
                "id", "name", "description", "unit_of_measure",
                "minimum_stock", "maximum_stock", "supplier", "supplier_name",
                "is_active", "created_at", "updated_at"
            ]
            read_only_fields = ["id", "created_at", "updated_at"]


class StockLotSerializer(serializers.ModelSerializer):
    """Sérialiseur pour le modèle StockLot."""

    ingredient_name = serializers.CharField(
        source="ingredient.name", read_only=True
    )
    supplier_name = serializers.CharField(
        source="supplier.name", read_only=True, allow_null=True
    )
    is_expired = serializers.BooleanField(read_only=True)

    class Meta:
        model = StockLot
        fields = [
            "id", "lot_id", "ingredient", "ingredient_name", "supplier",
            "supplier_name",
            "quantity_received", "quantity_remaining",
            "date_received", "date_expiration",
            "cost_per_unit", "country_of_origin", "is_active",
            "is_expired", "created_at", "updated_at"
        ]
        read_only_fields = [
            "id", "lot_id", "ingredient_name", "quantity_remaining",
            "supplier_name", "is_expired", "created_at", "updated_at",
        ]


class StockAdjustmentSerializer(serializers.Serializer):
    counted_quantity = serializers.DecimalField(
        max_digits=12, decimal_places=3, min_value=0
    )
    reason = serializers.CharField(max_length=200, allow_blank=False)


class StockWasteSerializer(serializers.Serializer):
    quantity = serializers.DecimalField(
        max_digits=12, decimal_places=3, min_value=Decimal("0.001")
    )
    reason = serializers.CharField(max_length=200, allow_blank=False)


class StockLotCreateSerializer(serializers.Serializer):
    ingredient = serializers.PrimaryKeyRelatedField(
        queryset=Ingredient.objects.filter(is_active=True)
    )
    supplier = serializers.PrimaryKeyRelatedField(
        queryset=Supplier.objects.filter(is_active=True),
        required=False,
        allow_null=True,
    )
    quantity_received = serializers.DecimalField(
        max_digits=12, decimal_places=3, min_value=Decimal("0.001")
    )
    cost_per_unit = serializers.DecimalField(
        max_digits=10, decimal_places=2, min_value=0
    )
    date_received = serializers.DateField()
    date_expiration = serializers.DateField()
    country_of_origin = serializers.CharField(
        max_length=100, required=False, allow_blank=True
    )

    def validate(self, attrs):
        if attrs["date_expiration"] < attrs["date_received"]:
            raise serializers.ValidationError(
                {"date_expiration": "La date doit être postérieure à la réception."}
            )
        return attrs


class StockMovementSerializer(serializers.ModelSerializer):
    """Sérialiseur pour le modèle StockMovement."""

    lot_lot_id = serializers.CharField(source="lot.lot_id", read_only=True)
    lot_ingredient_name = serializers.CharField(
        source="lot.ingredient.name", read_only=True
    )

    class Meta:
        model = StockMovement
        fields = [
            "id", "lot", "lot_lot_id", "lot_ingredient_name",
            "movement_type", "quantity", "unit_cost", "total_cost",
            "reference_order", "noted_by", "notes", "created_at"
        ]
        read_only_fields = ["id", "lot_lot_id", "lot_ingredient_name", "created_at"]


class InventoryAlertSerializer(serializers.ModelSerializer):
    ingredient_name = serializers.CharField(source="ingredient.name", read_only=True)
    lot_id = serializers.CharField(
        source="stock_lot.lot_id", read_only=True, allow_null=True
    )

    class Meta:
        model = InventoryAlert
        fields = [
            "id",
            "ingredient",
            "ingredient_name",
            "stock_lot",
            "lot_id",
            "alert_type",
            "message",
            "is_resolved",
            "resolved_at",
            "created_at",
        ]
        read_only_fields = fields


class RecipeVersionSerializer(serializers.ModelSerializer):
    """Sérialiseur pour le modèle RecipeVersion."""

    items = serializers.SerializerMethodField()

    @extend_schema_field(serializers.ListField(child=serializers.DictField()))
    def get_items(self, obj):
        return RecipeItemSerializer(obj.items.select_related("ingredient"), many=True).data

    class Meta:
        model = RecipeVersion
        fields = [
            "id", "menu_item_id", "name", "description", "is_active",
            "version_number", "valid_from", "valid_until", "created_by",
            "notes", "items"
        ]
        read_only_fields = fields


class RecipePublishItemSerializer(serializers.Serializer):
    ingredient = serializers.PrimaryKeyRelatedField(
        queryset=Ingredient.objects.filter(is_active=True)
    )
    quantity_required = serializers.DecimalField(
        max_digits=12,
        decimal_places=3,
        min_value=Decimal("0.001"),
    )
    is_required = serializers.BooleanField(required=False, default=True)


class RecipePublishSerializer(serializers.Serializer):
    menu_item_id = serializers.CharField(max_length=50)
    name = serializers.CharField(max_length=160)
    notes = serializers.CharField(required=False, allow_blank=True)
    items = RecipePublishItemSerializer(many=True, allow_empty=False)


class RecipeItemSerializer(serializers.ModelSerializer):
    """Sérialiseur pour le modèle RecipeItem."""

    ingredient_name = serializers.CharField(
        source="ingredient.name", read_only=True
    )
    ingredient_unit = serializers.CharField(
        source="ingredient.unit_of_measure", read_only=True
    )

    class Meta:
        model = RecipeItem
        fields = [
            "id", "recipe_version", "ingredient", "ingredient_name",
            "ingredient_unit", "quantity_required", "is_required",
            "created_at", "updated_at"
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class RecipeConsumptionSerializer(serializers.ModelSerializer):
    """Sérialiseur pour le modèle RecipeConsumption."""

    recipe_name = serializers.CharField(
        source="recipe_version.name", read_only=True
    )
    order_id = serializers.CharField(source="order.id", read_only=True)

    class Meta:
        model = RecipeConsumption
        fields = [
            "id", "recipe_version", "recipe_name", "order_id",
            "consumed_at", "quantity_consumed_per_item",
            "stock_remaining_after", "notes"
        ]
        read_only_fields = ["id", "consumed_at", "order_id"]