from django.db import models

from common.constants import LocationType
from common.models import BaseModel


class Location(BaseModel):
    type = models.CharField(max_length=12, choices=LocationType.choices)
    reference = models.CharField(max_length=30)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["type", "reference"]
        constraints = [
            models.UniqueConstraint(
                fields=["type", "reference"], name="unique_location_type_reference"
            )
        ]

    def __str__(self):
        return f"{self.type} {self.reference}"
