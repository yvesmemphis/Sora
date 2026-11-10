from rest_framework import serializers

from .models import Forecast


class ForecastSerializer(serializers.ModelSerializer):
    class Meta:
        model = Forecast
        fields = (
            "id",
            "menu_item_id",
            "menu_item_name",
            "period_start",
            "period_end",
            "version",
            "predicted_quantity",
            "confidence",
            "explanation",
            "status",
            "generated_at",
            "reviewed_by",
            "reviewed_at",
            "rejection_reason",
        )
        read_only_fields = fields


class ForecastReviewSerializer(serializers.Serializer):
    reason = serializers.CharField(required=False, allow_blank=True, max_length=2000)
