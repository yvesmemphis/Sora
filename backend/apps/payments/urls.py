from django.urls import path

from .views import (
    OrderPaymentsView,
    CashRegisterClosureView,
    PaymentDailyReportView,
    PaymentRefundsView,
    RefundProcessView,
)

app_name = "payments"

urlpatterns = [
    path("payments/", PaymentDailyReportView.as_view(), name="payment-daily-report"),
    path(
        "cash-register/closures/",
        CashRegisterClosureView.as_view(),
        name="cash-register-closures",
    ),
    path(
        "orders/<int:order_id>/payments/",
        OrderPaymentsView.as_view(),
        name="order-payments",
    ),
    path(
        "payments/<int:payment_id>/refunds/",
        PaymentRefundsView.as_view(),
        name="payment-refunds",
    ),
    path(
        "refunds/<int:refund_id>/process/",
        RefundProcessView.as_view(),
        name="refund-process",
    ),
]
