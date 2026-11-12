from collections import defaultdict
from decimal import Decimal

from django.db.models import Sum
from django.shortcuts import get_object_or_404
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import status
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.orders.models import Order
from apps.orders.services import waiter_can_access_order
from common.constants import FRONT_OF_HOUSE, MANAGERS, Role
from common.permissions import RolePermission

from . import services
from .models import Payment, Refund
from .serializers import (
    PaymentCreateSerializer,
    PaymentDailyQuerySerializer,
    PaymentDailyReportSerializer,
    PaymentDailyTotalSerializer,
    PaymentSerializer,
    PaymentSummarySerializer,
    RefundCreateSerializer,
    RefundProcessSerializer,
    RefundSerializer,
)


def _require_roles(user, roles):
    if not user.is_active or user.role not in roles:
        raise PermissionDenied("Rôle non autorisé.")


def _can_access_order(user, order):
    if user.role in MANAGERS:
        return True
    return user.role == Role.WAITER and waiter_can_access_order(order, user)


class OrderPaymentsView(APIView):
    permission_classes = [RolePermission]
    role_map = {"*": FRONT_OF_HOUSE}

    @extend_schema(responses=PaymentSerializer(many=True))
    def get(self, request, order_id):
        _require_roles(request.user, MANAGERS | {Role.WAITER})
        order = get_object_or_404(Order, pk=order_id)
        if not _can_access_order(request.user, order):
            raise PermissionDenied("Commande non accessible.")
        payments = Payment.objects.filter(order=order).order_by("-created_at")
        serializer_class = (
            PaymentSerializer
            if request.user.role in MANAGERS
            else PaymentSummarySerializer
        )
        return Response(serializer_class(payments, many=True).data)

    @extend_schema(
        request=PaymentCreateSerializer,
        responses={201: PaymentSerializer},
    )
    def post(self, request, order_id):
        _require_roles(request.user, MANAGERS | {Role.WAITER})
        order = get_object_or_404(Order, pk=order_id)
        if not _can_access_order(request.user, order):
            raise PermissionDenied("Commande non accessible.")
        serializer = PaymentCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        payment = services.register_payment(
            order=order,
            user=request.user,
            **serializer.validated_data,
        )
        serializer_class = (
            PaymentSerializer
            if request.user.role in MANAGERS
            else PaymentSummarySerializer
        )
        return Response(
            serializer_class(payment).data,
            status=status.HTTP_201_CREATED,
        )


class PaymentDailyReportView(APIView):
    permission_classes = [RolePermission]
    role_map = {"*": MANAGERS}

    @extend_schema(
        parameters=[
            OpenApiParameter(
                "date",
                str,
                OpenApiParameter.QUERY,
                required=True,
                description="Date des paiements à consulter, au format AAAA-MM-JJ.",
            ),
        ],
        responses=PaymentDailyReportSerializer,
        description=(
            "Retourne les paiements créés à la date demandée et les montants "
            "encaissés/remboursés regroupés par mode et devise."
        ),
    )
    def get(self, request):
        query = PaymentDailyQuerySerializer(data=request.query_params)
        query.is_valid(raise_exception=True)
        target_date = query.validated_data["date"]

        payments = Payment.objects.filter(
            created_at__date=target_date
        ).select_related("order")
        totals = defaultdict(
            lambda: {"gross_collected": Decimal("0.00"), "refunded": Decimal("0.00")}
        )
        payment_totals = (
            Payment.objects.filter(
                created_at__date=target_date,
                status__in=["CONFIRMED", "REFUNDED"],
            )
            .values("payment_method", "currency")
            .annotate(total=Sum("amount"))
        )
        for row in payment_totals:
            key = (row["payment_method"], row["currency"])
            totals[key]["gross_collected"] = row["total"] or Decimal("0.00")

        refund_totals = (
            Refund.objects.filter(
                status="COMPLETED",
                processed_at__date=target_date,
            )
            .values("payment__payment_method", "payment__currency")
            .annotate(total=Sum("amount"))
        )
        for row in refund_totals:
            key = (row["payment__payment_method"], row["payment__currency"])
            totals[key]["refunded"] = row["total"] or Decimal("0.00")

        total_rows = [
            {
                "payment_method": method,
                "currency": currency,
                "gross_collected": values["gross_collected"],
                "refunded": values["refunded"],
                "net_collected": values["gross_collected"] - values["refunded"],
            }
            for (method, currency), values in sorted(totals.items())
        ]
        return Response(
            {
                "date": target_date,
                "payments": PaymentSerializer(payments, many=True).data,
                "totals": PaymentDailyTotalSerializer(total_rows, many=True).data,
            }
        )


class PaymentRefundsView(APIView):
    permission_classes = [RolePermission]
    role_map = {"*": MANAGERS}

    @extend_schema(
        request=RefundCreateSerializer,
        responses={201: RefundSerializer},
    )
    def post(self, request, payment_id):
        _require_roles(request.user, MANAGERS)
        payment = get_object_or_404(Payment, pk=payment_id)
        serializer = RefundCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        refund = services.refund_payment(
            payment=payment,
            user=request.user,
            **serializer.validated_data,
        )
        return Response(
            RefundSerializer(refund).data,
            status=status.HTTP_201_CREATED,
        )


class RefundProcessView(APIView):
    permission_classes = [RolePermission]
    role_map = {"*": MANAGERS}

    @extend_schema(
        request=RefundProcessSerializer,
        responses=RefundSerializer,
    )
    def post(self, request, refund_id):
        _require_roles(request.user, MANAGERS)
        serializer = RefundProcessSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        refund = services.process_refund(
            refund_id=refund_id,
            target_status=serializer.validated_data["status"],
            user=request.user,
        )
        return Response(RefundSerializer(refund).data)
