from django.db import models


class Role(models.TextChoices):
    ADMIN = "ADMIN"
    MANAGER = "MANAGER"
    WAITER = "WAITER"
    KITCHEN = "KITCHEN"


ALL_ROLES = {Role.ADMIN, Role.MANAGER, Role.WAITER, Role.KITCHEN}
MANAGERS = {Role.ADMIN, Role.MANAGER}
FRONT_OF_HOUSE = {Role.ADMIN, Role.MANAGER, Role.WAITER}

PAYMENT_METHOD_CHOICES = [
    ("carte_bleue", "Carte"),
    ("virement", "Virement"),
    ("espece", "Espèces"),
    ("card", "Card"),
    ("cash", "Cash"),
    ("bank_transfer", "Bank transfer"),
    ("other", "Other"),
]


class OrderStatus(models.TextChoices):
    RECEIVED = "RECEIVED"
    CONFIRMED = "CONFIRMED"
    PREPARING = "PREPARING"
    READY = "READY"
    OUT_FOR_DELIVERY = "OUT_FOR_DELIVERY"
    SERVED = "SERVED"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"
    REJECTED = "REJECTED"


class OrderMode(models.TextChoices):
    DINE_IN = "DINE_IN"
    ROOM = "ROOM"
    TAKEAWAY = "TAKEAWAY"


class LocationType(models.TextChoices):
    TABLE = "TABLE"
    ROOM = "ROOM"
    TAKEAWAY = "TAKEAWAY"
