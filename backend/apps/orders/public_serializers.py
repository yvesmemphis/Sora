from rest_framework import serializers

from common.constants import LocationType, OrderMode
from common.serializers import PaymentMethodField


class OrderLineSerializer(serializers.Serializer):
    dish_id = serializers.UUIDField()
    quantity = serializers.IntegerField(min_value=1, max_value=20)
    notes = serializers.CharField(max_length=200, required=False, allow_blank=True)


class LocationRefSerializer(serializers.Serializer):
    type = serializers.ChoiceField(choices=LocationType.choices)
    reference = serializers.CharField(max_length=30)


class PublicOrderSerializer(serializers.Serializer):
    mode = serializers.ChoiceField(choices=OrderMode.choices)
    location = LocationRefSerializer(required=False)
    payment_method_expected = PaymentMethodField(required=False, allow_blank=True)
    note = serializers.CharField(max_length=300, required=False, allow_blank=True)
    items = OrderLineSerializer(many=True, allow_empty=False)

    def validate_items(self, value):
        if len(value) > 30:
            raise serializers.ValidationError("Maximum 30 lignes par commande.")
        return value


class PublicOrderResponseSerializer(serializers.Serializer):
    number = serializers.CharField()
    total = serializers.DecimalField(max_digits=12, decimal_places=2)
    currency = serializers.CharField(max_length=3)
    payment_method_expected = serializers.CharField(allow_blank=True)
    withdrawal_delay_minutes = serializers.IntegerField()
    tracking_token = serializers.CharField()


class TrackItemSerializer(serializers.Serializer):
    name = serializers.CharField(source="menu_item_name")
    quantity = serializers.IntegerField()


class TrackOrderSerializer(serializers.Serializer):
    number = serializers.CharField()
    status = serializers.CharField()
    payment_method_expected = serializers.CharField(allow_blank=True)
    created_at = serializers.DateTimeField()
    withdrawal_delay_minutes = serializers.IntegerField()
    withdrawal_deadline = serializers.DateTimeField()
    can_cancel = serializers.BooleanField()
    total = serializers.DecimalField(max_digits=12, decimal_places=2)
    currency = serializers.CharField(max_length=3)
    items = TrackItemSerializer(many=True)
