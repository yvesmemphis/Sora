# serializers.py pour l'app Kitchen (Dev 2)

from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from apps.orders.models import OrderItem

from .models import KitchenQueueItem


class KitchenOrderItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = OrderItem
        fields = ["menu_item_name", "quantity", "special_instructions"]
        read_only_fields = fields


class KitchenQueueItemSerializer(serializers.ModelSerializer):
    """
    Sérialiseur pour les items de la file de cuisine.
    Ne diffuse que des données minimales : ID, numéro, statut, etc.
    """

    order_number = serializers.SerializerMethodField()
    table_number = serializers.IntegerField(source="order.table_number", read_only=True)
    items = serializers.SerializerMethodField()

    @extend_schema_field(serializers.CharField())
    def get_order_number(self, obj):
        return obj.order.number or str(obj.order_id)

    @extend_schema_field(KitchenOrderItemSerializer(many=True))
    def get_items(self, obj):
        order_items = obj.order.items.all()
        return KitchenOrderItemSerializer(order_items, many=True).data

    class Meta:
        model = KitchenQueueItem
        fields = [
            "id",
            "order_number",
            "table_number",
            "items",
            "status",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "order_number",
            "customer_name",
            "status",
            "created_at",
            "updated_at",
        ]
