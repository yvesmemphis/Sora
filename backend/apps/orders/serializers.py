from decimal import Decimal

from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from apps.locations.models import Location
from common.constants import OrderMode
from common.serializers import PaymentMethodField

from .models import ORDER_STATUS_CHOICES, Order, OrderItem, OrderStatusHistory


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


class OrderStatusHistorySerializer(serializers.ModelSerializer):
    class Meta:
        model = OrderStatusHistory
        fields = ["from_status", "to_status", "changed_at", "note"]
        read_only_fields = fields


class OrderSerializer(serializers.ModelSerializer):
    payment_method_expected = PaymentMethodField(required=False, allow_blank=True)
    items = OrderItemSerializer(many=True, read_only=True)
    location_type = serializers.CharField(
        source="location.type", read_only=True, allow_null=True
    )
    location_reference = serializers.CharField(
        source="location.reference", read_only=True, allow_null=True
    )
    amount_paid = serializers.SerializerMethodField()
    is_paid = serializers.SerializerMethodField()
    status_history = OrderStatusHistorySerializer(many=True, read_only=True)

    @extend_schema_field(serializers.DecimalField(max_digits=12, decimal_places=2))
    def get_amount_paid(self, obj):
        if not hasattr(obj, "_api_amount_paid"):
            payments = obj.payments.all()
            confirmed = sum(
                (
                    payment.amount
                    for payment in payments
                    if payment.status in {"CONFIRMED", "REFUNDED"}
                ),
                Decimal("0.00"),
            )
            refunded = sum(
                (
                    refund.amount
                    for payment in payments
                    for refund in payment.refunds.all()
                    if refund.status == "COMPLETED"
                ),
                Decimal("0.00"),
            )
            obj._api_amount_paid = confirmed - refunded
        return obj._api_amount_paid

    @extend_schema_field(serializers.BooleanField())
    def get_is_paid(self, obj):
        return self.get_amount_paid(obj) >= obj.total

    class Meta:
        model = Order
        fields = [
            "id",
            "number",
            "status",
            "mode",
            "location",
            "location_type",
            "location_reference",
            "source",
            "table_number",
            "customer_name",
            "customer_phone",
            "subtotal",
            "tax",
            "total",
            "currency",
            "payment_method_expected",
            "amount_paid",
            "is_paid",
            "discount",
            "notes",
            "created_at",
            "updated_at",
            "items",
            "status_history",
        ]
        read_only_fields = fields


class KitchenOrderSerializer(serializers.ModelSerializer):
    items = KitchenOrderItemSerializer(many=True, read_only=True)
    location_type = serializers.CharField(
        source="location.type", read_only=True, allow_null=True
    )
    location_reference = serializers.CharField(
        source="location.reference", read_only=True, allow_null=True
    )

    class Meta:
        model = Order
        fields = [
            "id",
            "number",
            "status",
            "mode",
            "table_number",
            "location_type",
            "location_reference",
            "notes",
            "created_at",
            "updated_at",
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
    payment_method_expected = PaymentMethodField(required=False, allow_blank=True)
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


class OrderLocationSerializer(serializers.Serializer):
    location = serializers.PrimaryKeyRelatedField(
        queryset=Location.objects.filter(is_active=True),
        allow_null=True,
    )


class OrderListQuerySerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=ORDER_STATUS_CHOICES, required=False)
    date = serializers.DateField(required=False)
    created_after = serializers.DateTimeField(required=False)
    page = serializers.IntegerField(min_value=1, required=False)
    page_size = serializers.IntegerField(min_value=1, max_value=100, required=False)
