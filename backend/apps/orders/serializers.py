from rest_framework import serializers

from apps.locations.models import Location
from common.constants import OrderMode

from .models import ORDER_STATUS_CHOICES, Order, OrderItem


class OrderItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = OrderItem
        fields = [
            "id",
            "menu_item_id",
            "menu_item_name",
            "quantity",
            "unit_price",
            "total_price",
            "special_instructions",
            "created_at",
        ]
        read_only_fields = fields


class KitchenOrderItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = OrderItem
        fields = ["menu_item_id", "menu_item_name", "quantity", "special_instructions"]
        read_only_fields = fields


class OrderSerializer(serializers.ModelSerializer):
    items = OrderItemSerializer(many=True, read_only=True)

    class Meta:
        model = Order
        fields = [
            "id",
            "number",
            "status",
            "mode",
            "location",
            "source",
            "table_number",
            "customer_name",
            "customer_phone",
            "subtotal",
            "tax",
            "total",
            "discount",
            "notes",
            "created_at",
            "updated_at",
            "items",
        ]
        read_only_fields = fields


class KitchenOrderSerializer(serializers.ModelSerializer):
    items = KitchenOrderItemSerializer(many=True, read_only=True)

    class Meta:
        model = Order
        fields = [
            "id",
            "number",
            "status",
            "mode",
            "table_number",
            "notes",
            "created_at",
            "items",
        ]
        read_only_fields = fields


class OrderItemInputSerializer(serializers.Serializer):
    menu_item_id = serializers.CharField(max_length=50)
    quantity = serializers.IntegerField(min_value=1)
    special_instructions = serializers.CharField(
        max_length=500, required=False, allow_blank=True
    )

    def to_internal_value(self, data):
        unknown = set(data) - set(self.fields)
        if unknown:
            raise serializers.ValidationError(
                {
                    field: "Champ non accepté; le prix est calculé côté serveur."
                    for field in sorted(unknown)
                }
            )
        return super().to_internal_value(data)


class OrderCreateSerializer(serializers.Serializer):
    items = OrderItemInputSerializer(many=True, allow_empty=False)
    mode = serializers.ChoiceField(
        choices=OrderMode.choices, required=False, default=OrderMode.TAKEAWAY
    )
    location = serializers.PrimaryKeyRelatedField(
        queryset=Location.objects.filter(is_active=True),
        required=False,
        allow_null=True,
    )
    table_number = serializers.IntegerField(
        min_value=1, required=False, allow_null=True
    )
    customer_name = serializers.CharField(
        max_length=120, required=False, allow_blank=True
    )
    customer_phone = serializers.CharField(
        max_length=30, required=False, allow_blank=True
    )
    notes = serializers.CharField(max_length=1000, required=False, allow_blank=True)

    def to_internal_value(self, data):
        unknown = set(data) - set(self.fields)
        if unknown:
            raise serializers.ValidationError(
                {field: "Champ non accepté." for field in sorted(unknown)}
            )
        return super().to_internal_value(data)


class OrderTransitionSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=ORDER_STATUS_CHOICES)
    note = serializers.CharField(max_length=500, required=False, allow_blank=True)
