from rest_framework import serializers

from common.constants import LocationType, OrderMode


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
    note = serializers.CharField(max_length=300, required=False, allow_blank=True)
    items = OrderLineSerializer(many=True, allow_empty=False)

    def validate_items(self, value):
        if len(value) > 30:
            raise serializers.ValidationError("Maximum 30 lignes par commande.")
        return value


class PublicOrderResponseSerializer(serializers.Serializer):
    number = serializers.CharField()
    total = serializers.DecimalField(max_digits=12, decimal_places=2)
    tracking_token = serializers.CharField()


class TrackItemSerializer(serializers.Serializer):
    name = serializers.CharField(source="menu_item_name")
    quantity = serializers.IntegerField()


class TrackOrderSerializer(serializers.Serializer):
    number = serializers.CharField()
    status = serializers.CharField()
    created_at = serializers.DateTimeField()
    items = TrackItemSerializer(many=True)
