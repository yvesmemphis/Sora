from django.conf import settings
from django.db import models

ORDER_STATUS_CHOICES = [
    ("RECEIVED", "Received"),
    ("CONFIRMED", "Confirmed"),
    ("PREPARING", "Preparing"),
    ("READY", "Ready"),
    ("SERVED", "Served"),
    ("COMPLETED", "Completed"),
    ("CANCELLED", "Cancelled"),
    ("REJECTED", "Rejected"),
]


class OrderStatusHistory(models.Model):
    """Historique des transitions de statut des commandes."""

    order = models.ForeignKey(
        "orders.Order", on_delete=models.CASCADE, related_name="status_history"
    )
    from_status = models.CharField(max_length=20, null=True, blank=True)
    to_status = models.CharField(max_length=20)
    changed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )
    changed_at = models.DateTimeField(auto_now_add=True)
    note = models.TextField(null=True, blank=True)

    class Meta:
        ordering = ["-changed_at"]
        verbose_name = "Order Status History"
        verbose_name_plural = "Order Status Histories"

    def __str__(self):
        return f"Order {self.order.id}: {self.from_status} -> {self.to_status}"


class Order(models.Model):
    """Modèle de commande principal."""

    STATUS_CHOICES = ORDER_STATUS_CHOICES

    idempotency_key = models.CharField(
        max_length=64,
        unique=True,
        null=True,
        blank=True,
        help_text="Clé d'idempotence pour les requêtes en double",
    )
    idempotency_fingerprint = models.CharField(max_length=64, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_orders",
    )
    status = models.CharField(
        max_length=20, choices=STATUS_CHOICES, default="RECEIVED"
    )
    table_number = models.IntegerField(
        null=True, blank=True, help_text="Numéro de table (si applicable)"
    )
    customer_name = models.CharField(max_length=120, null=True, blank=True)
    customer_phone = models.CharField(max_length=30, null=True, blank=True)
    subtotal = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    tax = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    total = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    discount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    notes = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Order"
        verbose_name_plural = "Orders"
        constraints = (
            models.CheckConstraint(
                condition=models.Q(subtotal__gte=0),
                name="orders_subtotal_gte0",
            ),
            models.CheckConstraint(
                condition=models.Q(tax__gte=0),
                name="orders_tax_gte0",
            ),
            models.CheckConstraint(
                condition=models.Q(discount__gte=0),
                name="orders_discount_gte0",
            ),
            models.CheckConstraint(
                condition=models.Q(total__gte=0),
                name="orders_total_gte0",
            ),
        )

    def __str__(self):
        return f"Order {self.id} - {self.status}"

    def get_total(self):
        """Retourne le total TTC de la commande."""
        return self.total


class OrderItem(models.Model):
    """Ligne de commande - détail des articles."""

    order = models.ForeignKey(
        Order, on_delete=models.CASCADE, related_name="items"
    )
    menu_item_id = models.CharField(max_length=50)
    menu_item_name = models.CharField(max_length=120)
    quantity = models.PositiveIntegerField(default=1)
    unit_price = models.DecimalField(max_digits=10, decimal_places=2)
    total_price = models.DecimalField(max_digits=12, decimal_places=2)
    special_instructions = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Order Item"
        verbose_name_plural = "Order Items"
        constraints = [
            models.CheckConstraint(
                condition=models.Q(quantity__gt=0),
                name="orders_item_quantity_gt0",
            ),
            models.CheckConstraint(
                condition=models.Q(unit_price__gte=0),
                name="orders_item_unit_price_gte0",
            ),
        ]

    def __str__(self):
        return f"{self.menu_item_name} x{self.quantity} - Order {self.order.id}"

    def save(self, *args, **kwargs):
        """Calcule le prix total avant sauvegarde."""
        self.total_price = self.unit_price * self.quantity
        super().save(*args, **kwargs)

    def get_cost(self):
        """Retourne le coût unitaire de cette ligne."""
        return self.unit_price
