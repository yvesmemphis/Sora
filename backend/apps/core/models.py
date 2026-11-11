from django.db import models


class RestaurantSettings(models.Model):
    name = models.CharField(max_length=180, default="Mon restaurant")
    auto_confirm_orders = models.BooleanField(default=False)
    public_ordering_enabled = models.BooleanField(default=True)
    expiry_alert_days = models.PositiveSmallIntegerField(default=3)

    def save(self, *args, **kwargs):
        self.pk = 1
        super().save(*args, **kwargs)

    @classmethod
    def load(cls):
        return cls.objects.get_or_create(pk=1)[0]
