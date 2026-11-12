# models.py pour l'app Payments (Dev 2) - Modèle Payment

import re

from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.validators import MinValueValidator
from django.db import models

from common.constants import PAYMENT_METHOD_CHOICES


def luhn_ok(digits):
    total = 0
    for index, character in enumerate(reversed(digits)):
        value = int(character) * (2 if index % 2 else 1)
        total += value - 9 if value > 9 else value
    return total % 10 == 0


def reject_card_like(value):
    digits = re.sub(r"[\s-]", "", str(value or ""))
    if digits.isdigit() and 13 <= len(digits) <= 19 and luhn_ok(digits):
        raise ValidationError(
            "Numéro de carte non autorisé : merci de ne pas saisir de numéro de carte complet."
        )


class Payment(models.Model):
    """Modèle de paiement - enregistre les transactions financières."""

    STATUS_CHOICES = [
        ("PENDING", "En attente"),
        ("CONFIRMED", "Confirmé"),
        ("FAILED", "Échoué"),
        ("REFUNDED", "Remboursé"),
    ]
    METHOD_CHOICES = PAYMENT_METHOD_CHOICES

    order = models.ForeignKey(
        "orders.Order", on_delete=models.CASCADE, related_name="payments"
    )
    amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        validators=[MinValueValidator(0.01)],
        help_text="Montant du paiement (doit être > 0)",
    )
    currency = models.CharField(
        max_length=3, default="EUR", help_text="Code devise ISO 4217"
    )
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="PENDING")
    payment_method = models.CharField(
        max_length=50,
        choices=METHOD_CHOICES,
        help_text="Canonical payment method code.",
    )
    card_last_four = models.CharField(
        max_length=4,
        null=True,
        blank=True,
        validators=[reject_card_like],
        help_text="Derniers 4 chiffres (masqués)",
    )
    reference = models.CharField(
        max_length=64,
        unique=True,
        null=True,
        blank=True,
        help_text="Référence externe (ex: transaction ID banque)",
    )
    captured_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Payment"
        verbose_name_plural = "Payments"
        constraints = (
            models.CheckConstraint(
                condition=models.Q(amount__gt=0),
                name="payments_amount_gt0",
            ),
        )

    def __str__(self):
        return f"Payment {self.id} - {self.order.id} - {self.status}"

    def is_confirmed(self):
        """Vérifier si le paiement est confirmé."""
        return self.status == "CONFIRMED"

    def is_successful(self):
        """Vérifier si le paiement a réussi."""
        return self.status in ["CONFIRMED", "REFUNDED"]

    def can_be_refunded(self):
        """Vérifier si le paiement peut être remboursé."""
        return self.status == "CONFIRMED"


class Refund(models.Model):
    """Modèle de remboursement."""

    STATUS_CHOICES = [
        ("PENDING", "En attente"),
        ("PROCESSING", "En cours"),
        ("COMPLETED", "Terminé"),
        ("FAILED", "Échoué"),
    ]

    payment = models.ForeignKey(
        Payment, on_delete=models.CASCADE, related_name="refunds"
    )
    amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        validators=[MinValueValidator(0.01)],
        help_text="Montant du remboursement",
    )
    reason = models.TextField(help_text="Motif du remboursement")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="PENDING")
    processed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Refund"
        verbose_name_plural = "Refunds"
        constraints = (
            models.CheckConstraint(
                condition=models.Q(amount__gt=0),
                name="refunds_amount_gt0",
            ),
        )

    def __str__(self):
        return f"Refund {self.id} - Payment {self.payment.id} - {self.status}"

    def is_completed(self):
        """Vérifier si le remboursement est complet."""
        return self.status == "COMPLETED"


class CashRegisterClosure(models.Model):
    closed_for = models.DateField()
    closed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="cash_register_closures",
    )
    expected_totals = models.JSONField(default=list)
    expected_cash = models.JSONField(default=dict)
    counted_cash = models.JSONField(default=dict)
    closed_at = models.DateTimeField(auto_now_add=True)
    notes = models.CharField(max_length=500, blank=True)

    class Meta:
        ordering = ["-closed_for", "-closed_at"]
        constraints = [
            models.UniqueConstraint(
                fields=("closed_for", "closed_by"),
                name="payments_cash_closure_per_user_day",
            )
        ]


class PaymentFactory:
    """Factory simple pour les tests de paiement (non Django factory)."""

    @staticmethod
    def create(order, amount=25.50, status="CONFIRMED", **kwargs):
        """Créer un objet Payment sans sauvegarder en BDD."""
        return Payment(
            order=order,
            amount=amount,
            status=status,
            currency=order.currency,
            payment_method="card",
            reference=f"ref_{order.id}_{amount}",
            **kwargs,
        )
