from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType
from django.db import models

from common.constants import PAYMENT_METHOD_CHOICES


def default_payment_methods():
    return [method for method, _ in PAYMENT_METHOD_CHOICES]


class RestaurantSettings(models.Model):
    name = models.CharField(max_length=180, default="Mon restaurant")
    auto_confirm_orders = models.BooleanField(default=False)
    public_ordering_enabled = models.BooleanField(default=True)
    withdrawal_delay_minutes = models.PositiveSmallIntegerField(default=5)
    expiry_alert_days = models.PositiveSmallIntegerField(default=3)
    opening_hours = models.JSONField(default=dict, blank=True)
    accepted_payment_methods = models.JSONField(default=default_payment_methods)
    currency = models.CharField(max_length=3, default="XOF")

    def save(self, *args, **kwargs):
        self.pk = 1
        super().save(*args, **kwargs)

    @classmethod
    def load(cls):
        return cls.objects.get_or_create(pk=1)[0]


class DemoDataRecord(models.Model):
    content_type = models.ForeignKey(ContentType, on_delete=models.CASCADE)
    object_id = models.CharField(max_length=64)
    content_object = GenericForeignKey("content_type", "object_id")

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=("content_type", "object_id"),
                name="core_demo_data_record_unique",
            )
        ]


def register_demo_record(instance):
    content_type = ContentType.objects.get_for_model(instance)
    return DemoDataRecord.objects.get_or_create(
        content_type=content_type,
        object_id=str(instance.pk),
    )[0]
