from collections import defaultdict
from datetime import timedelta
from decimal import Decimal

from django.core.exceptions import PermissionDenied, ValidationError
from django.db import transaction
from django.db.models import Count, Max, Q, Sum
from django.utils import timezone

from apps.audit.services import log as audit_log
from apps.orders.models import Order, OrderItem
from apps.payments.models import Payment, Refund
from common.constants import MANAGERS

from .models import Forecast

COMPLETED_ORDER_STATUSES = ("SERVED", "COMPLETED")
REVENUE_PAYMENT_STATUSES = ("CONFIRMED", "REFUNDED")
MAX_OVERVIEW_DAYS = 366
DEFAULT_HISTORY_WEEKS = 8
MIN_HISTORY_DAYS = 3


def overview(start_date, end_date):
    """Return date-bounded operational indicators and net revenue."""
    if end_date < start_date:
        raise ValidationError("end_date must be on or after start_date.")
    if (end_date - start_date).days + 1 > MAX_OVERVIEW_DAYS:
        raise ValidationError("The requested date range cannot exceed 366 days.")

    orders = Order.objects.filter(created_at__date__range=(start_date, end_date))
    order_counts = orders.aggregate(
        total=Count("id"),
        completed=Count("id", filter=Q(status="COMPLETED")),
        cancelled=Count("id", filter=Q(status="CANCELLED")),
    )
    payments = Payment.objects.filter(status__in=REVENUE_PAYMENT_STATUSES).filter(
        Q(captured_at__date__range=(start_date, end_date))
        | Q(captured_at__isnull=True, created_at__date__range=(start_date, end_date))
    )
    paid_by_currency = {
        row["currency"]: row["amount"]
        for row in payments.values("currency").annotate(amount=Sum("amount"))
    }

    refunds = Refund.objects.filter(status="COMPLETED").filter(
        Q(processed_at__date__range=(start_date, end_date))
        | Q(
            processed_at__isnull=True,
            updated_at__date__range=(start_date, end_date),
        )
    )
    refunded_by_currency = {
        row["payment__currency"]: row["amount"]
        for row in refunds.values("payment__currency").annotate(amount=Sum("amount"))
    }
    revenue = {
        currency: format(
            paid_by_currency.get(currency, Decimal("0.00"))
            - refunded_by_currency.get(currency, Decimal("0.00")),
            ".2f",
        )
        for currency in sorted(paid_by_currency.keys() | refunded_by_currency.keys())
    }

    payment_counts = {
        row["status"]: row["count"]
        for row in Payment.objects.filter(
            created_at__date__range=(start_date, end_date)
        )
        .values("status")
        .annotate(count=Count("id"))
    }
    for payment_status in ("PENDING", "CONFIRMED", "FAILED", "REFUNDED"):
        payment_counts.setdefault(payment_status, 0)

    return {
        "start_date": start_date.isoformat(),
        "end_date": end_date.isoformat(),
        "orders": order_counts,
        "payments": payment_counts,
        "revenue": revenue,
    }


@transaction.atomic
def forecast_dish(target_date, *, history_weeks=DEFAULT_HISTORY_WEEKS):
    """Create one explainable next-period forecast per dish with enough history."""
    if history_weeks < 1:
        raise ValueError("history_weeks must be positive.")
    history_start = target_date - timedelta(weeks=history_weeks)
    history_end = target_date - timedelta(days=1)
    observed_dates = set(
        Order.objects.filter(
            status__in=COMPLETED_ORDER_STATUSES,
            created_at__date__range=(history_start, history_end),
        )
        .values_list("created_at__date", flat=True)
        .distinct()
    )
    matching_dates = sorted(
        day
        for day in observed_dates
        if day.weekday() == target_date.weekday()
    )
    if len(matching_dates) < MIN_HISTORY_DAYS:
        return []

    item_rows = (
        OrderItem.objects.filter(
            order__status__in=COMPLETED_ORDER_STATUSES,
            order__created_at__date__in=matching_dates,
        )
        .values("menu_item_id", "menu_item_name", "order__created_at__date")
        .annotate(quantity=Sum("quantity"))
        .order_by("order__created_at__date")
    )
    quantities = defaultdict(dict)
    names = {}
    for row in item_rows:
        item_id = row["menu_item_id"]
        names[item_id] = row["menu_item_name"]
        quantities[item_id][row["order__created_at__date"]] = row["quantity"]

    target_drafts = {
        forecast.menu_item_id: forecast
        for forecast in Forecast.objects.select_for_update().filter(
            period_start=target_date,
            period_end=target_date,
            status=Forecast.Status.DRAFT,
        )
    }
    max_versions = {
        row["menu_item_id"]: row["max_version"]
        for row in Forecast.objects.filter(
            period_start=target_date,
            period_end=target_date,
        )
        .values("menu_item_id")
        .annotate(max_version=Max("version"))
    }
    forecasts = []
    for item_id, values_by_date in quantities.items():
        history = [
            {"date": day.isoformat(), "quantity": values_by_date.get(day, 0)}
            for day in matching_dates
        ]
        values = [Decimal(entry["quantity"]) for entry in history]
        mean = sum(values) / len(values)
        if mean <= 0:
            continue
        mean_deviation = sum(abs(value - mean) for value in values) / len(values)
        confidence = min(Decimal(1), Decimal(len(values)) / history_weeks) / (
            Decimal(1) + mean_deviation / mean
        )
        confidence = min(Decimal(1), confidence).quantize(Decimal("0.0001"))
        draft = target_drafts.get(item_id)
        values = {
            "menu_item_name": names[item_id],
            "generated_at": timezone.now(),
            "predicted_quantity": mean.quantize(Decimal("0.01")),
            "confidence": confidence,
            "explanation": {
                "method": (
                    "mean of matching weekdays with completed orders; "
                    "days without sales for this dish count as zero"
                ),
                "history_weeks": history_weeks,
                "history_start": matching_dates[0].isoformat(),
                "history_end": matching_dates[-1].isoformat(),
                "observations": history,
            },
        }
        if draft:
            for field, value in values.items():
                setattr(draft, field, value)
            draft.save(update_fields=list(values))
            forecasts.append(draft)
            continue

        version = max_versions.get(item_id, 0) + 1
        forecast = Forecast.objects.create(
            menu_item_id=item_id,
            period_start=target_date,
            period_end=target_date,
            version=version,
            **values,
        )
        forecasts.append(forecast)
        max_versions[item_id] = version
    return forecasts


def review_forecast(*, forecast_id, actor, approve, reason=""):
    """Approve or reject a pending forecast, recording an audit event atomically."""
    if not getattr(actor, "is_authenticated", False) or actor.role not in MANAGERS:
        raise PermissionDenied("Only managers and administrators may review forecasts.")
    if not approve and not reason.strip():
        raise ValidationError({"reason": "A rejection reason is required."})

    with transaction.atomic():
        forecast = Forecast.objects.select_for_update().get(pk=forecast_id)
        if forecast.status != Forecast.Status.DRAFT:
            raise ValidationError("Only draft forecasts can be reviewed.")
        forecast.status = (
            Forecast.Status.APPROVED if approve else Forecast.Status.REJECTED
        )
        forecast.reviewed_by = actor
        forecast.reviewed_at = timezone.now()
        forecast.rejection_reason = "" if approve else reason.strip()
        forecast.save(
            update_fields=(
                "status",
                "reviewed_by",
                "reviewed_at",
                "rejection_reason",
            )
        )
        audit_log(
            actor=actor,
            action=(
                "analytics.forecast.approve"
                if approve
                else "analytics.forecast.reject"
            ),
            resource=forecast,
            metadata={"reason": forecast.rejection_reason},
        )
    return forecast


def daily_order_count(day=None):
    day = day or timezone.localdate()
    return Order.objects.filter(created_at__date=day).count()
