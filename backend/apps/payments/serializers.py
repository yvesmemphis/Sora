from decimal import Decimal

from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from .models import Payment, Refund, reject_card_like


class PaymentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Payment
        fields = [
            "id",
            "order",
            "amount",
            "currency",
            "status",
            "payment_method",
            "reference",
            "captured_at",
            "created_at",
        ]
        read_only_fields = fields


class PaymentSummarySerializer(serializers.ModelSerializer):
    class Meta:
        model = Payment
        fields = [
            "id",
            "order",
            "status",
            "payment_method",
            "currency",
            "created_at",
        ]
        read_only_fields = fields


class PaymentDailyQuerySerializer(serializers.Serializer):
    date = serializers.DateField()


class PaymentDailyTotalSerializer(serializers.Serializer):
    payment_method = serializers.CharField()
    currency = serializers.CharField(max_length=3)
    gross_collected = serializers.DecimalField(max_digits=14, decimal_places=2)
    refunded = serializers.DecimalField(max_digits=14, decimal_places=2)
    net_collected = serializers.DecimalField(max_digits=14, decimal_places=2)


class PaymentDailyReportSerializer(serializers.Serializer):
    date = serializers.DateField()
    payments = PaymentSerializer(many=True)
    totals = PaymentDailyTotalSerializer(many=True)


class RefundSerializer(serializers.ModelSerializer):
    payment_order_id = serializers.CharField(source="payment.order_id", read_only=True)
    currency = serializers.CharField(source="payment.currency", read_only=True)

    class Meta:
        model = Refund
        fields = [
            "id",
            "payment",
            "payment_order_id",
            "currency",
            "amount",
            "reason",
            "status",
            "processed_at",
            "created_at",
        ]
        read_only_fields = fields


class PaymentCreateSerializer(serializers.Serializer):
    amount = serializers.DecimalField(
        max_digits=12, decimal_places=2, min_value=Decimal("0.01")
    )
    payment_method = serializers.ChoiceField(
        choices=Payment.METHOD_CHOICES
    )
    reference = serializers.CharField(max_length=64, required=False, allow_blank=True)

    def validate_reference(self, value):
        try:
            reject_card_like(value)
        except DjangoValidationError as exc:
            raise serializers.ValidationError(exc.messages) from exc
        return value

    def to_internal_value(self, data):
        unknown = set(data) - set(self.fields)
        if unknown:
            raise serializers.ValidationError(
                {
                    field: "Champ non accepté; aucune donnée de carte ne doit être envoyée."
                    for field in sorted(unknown)
                }
            )
        return super().to_internal_value(data)


class RefundCreateSerializer(serializers.Serializer):
    amount = serializers.DecimalField(
        max_digits=12,
        decimal_places=2,
        min_value=Decimal("0.01"),
        required=False,
    )
    reason = serializers.CharField(max_length=500)


class RefundProcessSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=["COMPLETED", "FAILED"])
