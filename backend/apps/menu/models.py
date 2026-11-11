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
    category = models.ForeignKey(
        Category, on_delete=models.PROTECT, related_name="dishes"
    )
    name = models.CharField(max_length=160)
    description = models.TextField(blank=True, max_length=1000)
    price = models.DecimalField(max_digits=10, decimal_places=2)
    preparation_time = models.PositiveSmallIntegerField(null=True, blank=True)
    allergens = models.JSONField(default=list, blank=True)
    is_available = models.BooleanField(default=True)
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
