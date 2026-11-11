from decimal import Decimal
from typing import ClassVar

from rest_framework import serializers

from .models import ProductionBatch, WasteDeclaration


class ProductionBatchSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductionBatch
        fields: ClassVar = [
            "id",
            "product_name",
            "production_date",
            "quantity_produced",
            "quantity_remaining",
            "unit_cost",
            "notes",
            "created_at",
            "updated_at",
        ]
        read_only_fields: ClassVar = [
            "id",
            "quantity_remaining",
            "created_at",
            "updated_at",
        ]


class ProductionBatchStaffSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductionBatch
        fields: ClassVar = [
            "id",
            "product_name",
            "production_date",
            "quantity_produced",
            "quantity_remaining",
            "created_at",
        ]
        read_only_fields: ClassVar = fields


class ProductionBatchCreateSerializer(serializers.Serializer):
    product_name = serializers.CharField(max_length=120, allow_blank=False)
    production_date = serializers.DateField(required=False)
    quantity_produced = serializers.DecimalField(
        max_digits=12, decimal_places=2, min_value=Decimal("0.01")
    )
    unit_cost = serializers.DecimalField(
        max_digits=12, decimal_places=2, min_value=Decimal(0)
    )
    notes = serializers.CharField(required=False, allow_blank=True)


class ProductionBatchUpdateSerializer(serializers.Serializer):
    product_name = serializers.CharField(max_length=120, required=False)
    production_date = serializers.DateField(required=False)
    unit_cost = serializers.DecimalField(
        max_digits=12,
        decimal_places=2,
        min_value=Decimal(0),
        required=False,
    )
    notes = serializers.CharField(required=False, allow_blank=True)


class WasteDeclarationSerializer(serializers.ModelSerializer):
    declared_by = serializers.CharField(
        source="created_by.get_username", read_only=True
    )

    class Meta:
        model = WasteDeclaration
        fields: ClassVar = [
            "id",
            "batch",
            "remaining_quantity",
            "reusable_quantity",
            "discarded_quantity",
            "reason",
            "unit_cost_at_declaration",
            "estimated_cost",
            "declared_by",
            "declared_at",
            "created_at",
        ]
        read_only_fields: ClassVar = fields


class WasteDeclarationStaffSerializer(serializers.ModelSerializer):
    class Meta:
        model = WasteDeclaration
        fields: ClassVar = [
            "id",
            "batch",
            "remaining_quantity",
            "reusable_quantity",
            "discarded_quantity",
            "reason",
            "declared_at",
        ]
        read_only_fields: ClassVar = fields


class WasteDeclarationCreateSerializer(serializers.Serializer):
    batch = serializers.PrimaryKeyRelatedField(
        queryset=ProductionBatch.objects.all()
    )
    remaining_quantity = serializers.DecimalField(
        max_digits=12, decimal_places=2, min_value=Decimal("0.01")
    )
    reusable_quantity = serializers.DecimalField(
        max_digits=12, decimal_places=2, min_value=Decimal(0)
    )
    discarded_quantity = serializers.DecimalField(
        max_digits=12, decimal_places=2, min_value=Decimal(0)
    )
    reason = serializers.CharField(max_length=250, allow_blank=False)

    def validate(self, attrs):
        if attrs["remaining_quantity"] != (
            attrs["reusable_quantity"] + attrs["discarded_quantity"]
        ):
            raise serializers.ValidationError(
                {"remaining_quantity": "Doit être égale aux quantités réutilisable et jetée."}
            )
        return attrs


class WasteDeclarationUpdateSerializer(serializers.Serializer):
    remaining_quantity = serializers.DecimalField(
        max_digits=12, decimal_places=2, min_value=Decimal("0.01"), required=False
    )
    reusable_quantity = serializers.DecimalField(
        max_digits=12, decimal_places=2, min_value=Decimal(0), required=False
    )
    discarded_quantity = serializers.DecimalField(
        max_digits=12, decimal_places=2, min_value=Decimal(0), required=False
    )
    reason = serializers.CharField(
        max_length=250, allow_blank=False, required=False
    )

    def validate(self, attrs):
        if not attrs:
            raise serializers.ValidationError("Au moins un champ doit être fourni.")
        instance = self.instance
        remaining = attrs.get("remaining_quantity", instance.remaining_quantity)
        reusable = attrs.get("reusable_quantity", instance.reusable_quantity)
        discarded = attrs.get("discarded_quantity", instance.discarded_quantity)
        if remaining != reusable + discarded:
            raise serializers.ValidationError(
                {"remaining_quantity": "Doit être égale aux quantités réutilisable et jetée."}
            )
        return attrs
