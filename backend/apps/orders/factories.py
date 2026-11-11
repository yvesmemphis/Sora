import factory
from factory.django import DjangoModelFactory

from .models import Order, OrderItem, OrderStatusHistory


class OrderStatusHistoryFactory(DjangoModelFactory):
    """Factory for OrderStatusHistory model."""

    class Meta:
        model = OrderStatusHistory

    order = factory.SubFactory("apps.orders.factories.OrderFactory")
    from_status = factory.LazyAttribute(lambda o: "RECEIVED")
    to_status = factory.LazyAttribute(lambda o: "CONFIRMED")
    changed_by = None  # Will be set in tests


class OrderFactory(DjangoModelFactory):
    """Factory for Order model."""

    class Meta:
        model = Order

    idempotency_key = factory.Sequence(lambda n: f"key-{n:04d}")
    status = "RECEIVED"
    table_number = 1
    customer_name = "Test Customer"
    customer_phone = "1234567890"
    subtotal = 0
    tax = 0
    total = 0
    discount = 0
    notes = None


class OrderItemFactory(DjangoModelFactory):
    """Factory for OrderItem model."""

    class Meta:
        model = OrderItem

    order = factory.SubFactory("apps.orders.factories.OrderFactory")
    menu_item_id = factory.Sequence(lambda n: f"item-{n}")
    menu_item_name = factory.Sequence(lambda n: f"Menu Item {n}")
    quantity = 1
    unit_price = 10.50
    total_price = 10.50
    special_instructions = None
