# models.py pour l'app Kitchen (Dev 2)

from django.conf import settings
from django.db import models


class KitchenTicket(models.Model):
    """Ticket WebSocket à usage unique pour la cuisine."""

    ticket_id = models.CharField(
        max_length=32, unique=True, help_text="Identifiant unique du ticket WebSocket"
    )
    order = models.ForeignKey(
        "orders.Order",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="kitchen_tickets",
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="kitchen_tickets",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    is_used = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Kitchen Ticket"
        verbose_name_plural = "Kitchen Tickets"

    def __str__(self):
        return (
            f"Ticket {self.ticket_id} - Order {self.order_id if self.order else 'N/A'}"
        )

    def is_expired(self):
        """Vérifier si le ticket a expiré."""
        from django.utils import timezone

        return timezone.now() > self.expires_at

    def use(self):
        """Marquer le ticket comme utilisé."""
        self.is_used = True
        self.is_active = False
        self.save()


class KitchenQueueItem(models.Model):
    """Élément dans la file d'attente de cuisine."""

    ORDER_STATUS_CHOICES = [
        ("CONFIRMED", "Confirmée"),
        ("PREPARING", "En préparation"),
        ("READY", "Prêt"),
        ("SERVED", "Servi"),
    ]

    order = models.ForeignKey(
        "orders.Order", on_delete=models.CASCADE, related_name="queue_items"
    )
    status = models.CharField(
        max_length=20, choices=ORDER_STATUS_CHOICES, default="PREPARING"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["created_at"]
        verbose_name = "Queue Item"
        verbose_name_plural = "Queue Items"
        constraints = [
            models.UniqueConstraint(fields=["order"], name="kitchen_one_queue_item"),
        ]

    def __str__(self):
        return f"Order {self.order.id} - {self.status}"
