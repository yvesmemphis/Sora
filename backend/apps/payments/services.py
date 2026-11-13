from decimal import Decimal, InvalidOperation

from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from django.db.models import Sum
from django.utils import timezone

from apps.audit import services as audit
from apps.orders.models import Order
from apps.orders.services import transition_order, waiter_can_access_order
from common.constants import MANAGERS, OrderStatus, Role, normalize_payment_method
from common.exceptions import DomainError

from .models import Payment, Refund, reject_card_like

ZERO = Decimal("0.00")


def payment_totals_for_date(target_date):
    totals = {}
    payment_rows = (
        Payment.objects.filter(
            created_at__date=target_date,
            status__in=["CONFIRMED", "REFUNDED"],
        )
        .values("payment_method", "currency")
        .annotate(total=Sum("amount"))
    )
    for row in payment_rows:
        key = (row["payment_method"], row["currency"])
        totals[key] = {
            "gross_collected": row["total"] or ZERO,
            "refunded": ZERO,
        }

    refund_rows = (
        Refund.objects.filter(status="COMPLETED", processed_at__date=target_date)
        .values("payment__payment_method", "payment__currency")
        .annotate(total=Sum("amount"))
    )
    for row in refund_rows:
        key = (row["payment__payment_method"], row["payment__currency"])
        values = totals.setdefault(
            key, {"gross_collected": ZERO, "refunded": ZERO}
        )
        values["refunded"] = row["total"] or ZERO

    return [
        {
            "payment_method": method,
            "currency": currency,
            "gross_collected": values["gross_collected"],
            "refunded": values["refunded"],
            "net_collected": values["gross_collected"] - values["refunded"],
        }
        for (method, currency), values in sorted(totals.items())
    ]


def _require_actor(user, roles):
    if not user or not user.is_authenticated or not user.is_active:
        raise DomainError("authentication_required", "Authentification requise.", 401)
    if user.role not in roles:
        raise DomainError("permission_denied", "Rôle non autorisé.", 403)


def _amount(value, *, field="Montant"):
    try:
        amount = Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError):
        raise DomainError("invalid_amount", f"{field} invalide.", 400) from None
    if not amount.is_finite() or amount <= ZERO:
        raise DomainError(
            "invalid_amount", f"{field} doit être strictement positif.", 400
        )
    try:
        normalized = amount.quantize(Decimal("0.01"))
    except InvalidOperation:
        raise DomainError("invalid_amount", f"{field} invalide.", 400) from None
    if normalized != amount:
        raise DomainError(
            "invalid_amount", f"{field} doit avoir au maximum deux décimales.", 400
        )
    return normalized


def net_paid(order):
    confirmed = (
        Payment.objects.filter(
            order=order,
            status__in=["CONFIRMED", "REFUNDED"],
        ).aggregate(total=Sum("amount"))["total"]
        or ZERO
    )
    refunded = (
        Refund.objects.filter(
            payment__order=order,
            status="COMPLETED",
        ).aggregate(total=Sum("amount"))["total"]
        or ZERO
    )
    return confirmed - refunded


def settle_if_paid(order, *, actor):
    if order.status == OrderStatus.SERVED and net_paid(order) >= order.total:
        transition_order(
            order.pk,
            OrderStatus.COMPLETED,
            actor=actor,
            note="Commande soldée",
            internal=True,
        )
        return True
    return False


@transaction.atomic
def register_payment(*, order, amount, payment_method, user, reference=None):
    amount = _amount(amount)
    _require_actor(user, MANAGERS | {Role.WAITER})
    payment_method = normalize_payment_method(str(payment_method).strip())
    allowed_methods = {choice[0] for choice in Payment.METHOD_CHOICES}
    if payment_method not in allowed_methods:
        raise DomainError("invalid_payment_method", "Mode de paiement invalide.", 400)
    from apps.core.models import RestaurantSettings

    if payment_method not in RestaurantSettings.load().accepted_payment_methods:
        raise DomainError(
            "payment_method_unavailable",
            "Ce mode de paiement n'est pas accepté.",
            400,
        )
    try:
        reject_card_like(reference)
    except DjangoValidationError as exc:
        raise DomainError(
            "card_data_forbidden",
            str(exc),
            400,
        ) from exc
    try:
        locked_order = Order.objects.select_for_update().get(pk=order.pk)
    except Order.DoesNotExist:
        raise DomainError("order_not_found", "Commande introuvable.", 404) from None
    if locked_order.status in {
        OrderStatus.CANCELLED,
        OrderStatus.COMPLETED,
        OrderStatus.REJECTED,
    }:
        raise DomainError(
            "payment_not_allowed", "Cette commande n'accepte plus de paiement.", 409
        )
    if user.role == Role.WAITER and not waiter_can_access_order(locked_order, user):
        raise DomainError("permission_denied", "Commande non accessible.", 403)

    outstanding = locked_order.total - net_paid(locked_order)
    if amount > outstanding:
        raise DomainError(
            "overpayment",
            "Le paiement dépasse le solde restant.",
            409,
            details={"outstanding": str(max(outstanding, ZERO))},
        )
    payment = Payment.objects.create(
        order=locked_order,
        amount=amount,
        currency=locked_order.currency,
        status="CONFIRMED",
        payment_method=payment_method,
        reference=reference or None,
        captured_at=timezone.now(),
    )
    audit.log(
        actor=user,
        action="payment.registered",
        resource=payment,
        metadata={"order_id": str(locked_order.pk), "amount": str(amount)},
    )
    settle_if_paid(locked_order, actor=user)
    return payment


@transaction.atomic
def refund_payment(*, payment, amount=None, user, reason):
    _require_actor(user, MANAGERS)
    reason = str(reason or "").strip()
    if not reason:
        raise DomainError("reason_required", "Un motif est obligatoire.", 400)

    payment_order_id = (
        Payment.objects.filter(pk=payment.pk).values_list("order_id", flat=True).first()
    )
    if payment_order_id is None:
        raise DomainError("payment_not_found", "Paiement introuvable.", 404)
    Order.objects.select_for_update().get(pk=payment_order_id)
    try:
        locked_payment = Payment.objects.select_for_update().get(pk=payment.pk)
    except Payment.DoesNotExist:
        raise DomainError("payment_not_found", "Paiement introuvable.", 404) from None
    if locked_payment.status not in {"CONFIRMED", "REFUNDED"}:
        raise DomainError(
            "payment_not_refundable", "Ce paiement ne peut pas être remboursé.", 409
        )

    refund_amount = (
        _amount(amount, field="Montant du remboursement")
        if amount is not None
        else locked_payment.amount
    )
    reserved = (
        locked_payment.refunds.exclude(status="FAILED").aggregate(total=Sum("amount"))[
            "total"
        ]
        or ZERO
    )
    if reserved + refund_amount > locked_payment.amount:
        raise DomainError(
            "refund_limit_exceeded",
            "Le montant des remboursements dépasse le paiement.",
            409,
            details={"refundable": str(locked_payment.amount - reserved)},
        )

    refund = Refund.objects.create(
        payment=locked_payment,
        amount=refund_amount,
        reason=reason,
        status="PROCESSING",
    )
    audit.log(
        actor=user,
        action="payment.refund_requested",
        resource=refund,
        metadata={"payment_id": str(locked_payment.pk), "amount": str(refund_amount)},
    )
    return refund


@transaction.atomic
def process_refund(*, refund_id, target_status, user):
    _require_actor(user, MANAGERS)
    if target_status not in {"COMPLETED", "FAILED"}:
        raise DomainError(
            "invalid_refund_status", "Statut de remboursement invalide.", 400
        )

    payment_id = (
        Refund.objects.filter(pk=refund_id).values_list("payment_id", flat=True).first()
    )
    if payment_id is None:
        raise DomainError("refund_not_found", "Remboursement introuvable.", 404)
    payment_order_id = (
        Payment.objects.filter(pk=payment_id).values_list("order_id", flat=True).first()
    )
    Order.objects.select_for_update().get(pk=payment_order_id)
    locked_payment = Payment.objects.select_for_update().get(pk=payment_id)
    refund = Refund.objects.select_for_update().get(pk=refund_id)
    if refund.status != "PROCESSING":
        raise DomainError(
            "refund_already_processed",
            "Ce remboursement a déjà été traité.",
            409,
        )

    refund.status = target_status
    refund.processed_at = timezone.now()
    refund.save(update_fields=["status", "processed_at", "updated_at"])
    if target_status == "COMPLETED":
        completed_total = (
            locked_payment.refunds.filter(status="COMPLETED").aggregate(
                total=Sum("amount")
            )["total"]
            or ZERO
        )
        if completed_total >= locked_payment.amount:
            locked_payment.status = "REFUNDED"
            locked_payment.save(update_fields=["status", "updated_at"])

    audit.log(
        actor=user,
        action=f"payment.refund_{target_status.lower()}",
        resource=refund,
        metadata={"payment_id": str(locked_payment.pk)},
    )
    return refund
