from django.db import models

from common.models import BaseModel

from .validators import dish_image_path


class Category(BaseModel):
    name = models.CharField(max_length=120)
    position = models.PositiveSmallIntegerField(default=0)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["position", "name"]

    def __str__(self):
        return self.name


class Dish(BaseModel):
    class AvailabilityStatus(models.TextChoices):
        AVAILABLE = "AVAILABLE", "Disponible"
        SOLD_OUT = "SOLD_OUT", "Épuisé"
        TEMPORARILY_UNAVAILABLE = (
            "TEMPORARILY_UNAVAILABLE",
            "Temporairement indisponible",
        )

    category = models.ForeignKey(
        Category, on_delete=models.PROTECT, related_name="dishes"
    )
    name = models.CharField(max_length=160)
    description = models.TextField(blank=True, max_length=1000)
    price = models.DecimalField(max_digits=10, decimal_places=2)
    preparation_time = models.PositiveSmallIntegerField(null=True, blank=True)
    allergens = models.JSONField(default=list, blank=True)
    is_available = models.BooleanField(default=True)
    availability_status = models.CharField(
        max_length=26,
        choices=AvailabilityStatus.choices,
        default=AvailabilityStatus.AVAILABLE,
    )
    is_published = models.BooleanField(default=True)
    image = models.ImageField(upload_to=dish_image_path, null=True, blank=True)

    class Meta:
        ordering = ["category__position", "name"]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(price__gte=0), name="dish_price_gte_0"
            )
        ]
        indexes = [models.Index(fields=["is_published", "is_available"])]

    @property
    def is_active(self):
        return self.is_published and self.is_available and self.category.is_active

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        update_fields = kwargs.get("update_fields")
        if update_fields is not None:
            update_fields = set(update_fields)
            status_changed = "availability_status" in update_fields
            availability_changed = "is_available" in update_fields
            if status_changed:
                self.is_available = (
                    self.availability_status == self.AvailabilityStatus.AVAILABLE
                )
            elif availability_changed:
                self.availability_status = (
                    self.AvailabilityStatus.AVAILABLE
                    if self.is_available
                    else self.AvailabilityStatus.TEMPORARILY_UNAVAILABLE
                )
            kwargs["update_fields"] = update_fields | {
                "availability_status",
                "is_available",
            }
        elif not self.is_available:
            self.availability_status = self.AvailabilityStatus.TEMPORARILY_UNAVAILABLE
        else:
            self.is_available = (
                self.availability_status == self.AvailabilityStatus.AVAILABLE
            )
        super().save(*args, **kwargs)
