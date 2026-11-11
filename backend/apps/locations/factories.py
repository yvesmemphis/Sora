import factory
from factory.django import DjangoModelFactory

from common.constants import LocationType

from .models import Location


class LocationFactory(DjangoModelFactory):
    class Meta:
        model = Location

    type = LocationType.TABLE
    reference = factory.Sequence(lambda number: f"T{number + 1}")
