from django.urls import path

from .views import OrderPaymentsView, PaymentRefundsView, RefundProcessView

app_name = "payments"

urlpatterns = [
    path("orders/<int:order_id>/payments/", OrderPaymentsView.as_view(), name="order-payments"),
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
