from django.conf import settings
from django.db import models


class Forecast(models.Model):
    class Status(models.TextChoices):
        DRAFT = "DRAFT", "Draft"
        APPROVED = "APPROVED", "Approved"
        REJECTED = "REJECTED", "Rejected"

    menu_item_id = models.CharField(max_length=50)
    menu_item_name = models.CharField(max_length=120)
    period_start = models.DateField()
    period_end = models.DateField()
    version = models.PositiveIntegerField()
    predicted_quantity = models.DecimalField(max_digits=12, decimal_places=2)
    confidence = models.DecimalField(max_digits=5, decimal_places=4)
    explanation = models.JSONField(default=dict)
    status = models.CharField(
        max_length=12, choices=Status.choices, default=Status.DRAFT
    )
    generated_at = models.DateTimeField(auto_now_add=True)
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="reviewed_forecasts",
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)
    rejection_reason = models.TextField(blank=True)

    class Meta:
        ordering = ["period_start", "menu_item_name", "-version"]
        constraints = (
            models.UniqueConstraint(
                fields=("menu_item_id", "period_start", "period_end", "version"),
                name="analytics_forecast_version_unique",
            ),
            models.CheckConstraint(
                condition=models.Q(period_end__gte=models.F("period_start")),
                name="analytics_forecast_valid_period",
            ),
            models.CheckConstraint(
                condition=models.Q(confidence__gte=0, confidence__lte=1),
                name="analytics_forecast_valid_confidence",
            ),
        )
        indexes = (
            models.Index(fields=("period_start", "status")),
            models.Index(fields=("menu_item_id", "period_start")),
        )

    def __str__(self):
        return (
            f"{self.menu_item_name} ({self.period_start}–{self.period_end}) "
            f"v{self.version}"
        )
