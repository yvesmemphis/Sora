from rest_framework import serializers

from .constants import PAYMENT_METHOD_CHOICES, normalize_payment_method


class PaymentMethodField(serializers.ChoiceField):
    def __init__(self, **kwargs):
        super().__init__(choices=PAYMENT_METHOD_CHOICES, **kwargs)

    def to_internal_value(self, data):
        return super().to_internal_value(normalize_payment_method(data))
