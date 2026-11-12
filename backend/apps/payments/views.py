from django.db import IntegrityError, transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import status
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.audit import services as audit
from apps.orders.models import Order
from apps.orders.services import waiter_can_access_order
from common.constants import FRONT_OF_HOUSE, MANAGERS, Role
from common.permissions import RolePermission

from . import services
from .models import CashRegisterClosure, Payment
from .serializers import (
    CashRegisterClosureCreateSerializer,
    CashRegisterClosureQuerySerializer,
    CashRegisterClosureSerializer,
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
        total_rows = services.payment_totals_for_date(target_date)
        return Response(
            {
                "date": target_date,
                "payments": PaymentSerializer(payments, many=True).data,
                "totals": PaymentDailyTotalSerializer(total_rows, many=True).data,
            }
        )


class CashRegisterClosureView(APIView):
    permission_classes = [RolePermission]
    role_map = {"*": MANAGERS}

    @extend_schema(
        parameters=[CashRegisterClosureQuerySerializer],
        responses=CashRegisterClosureSerializer(many=True),
    )
    def get(self, request):
        target_date = request.query_params.get("date")
        closures = CashRegisterClosure.objects.select_related("closed_by")
        if target_date:
            query = CashRegisterClosureQuerySerializer(data={"date": target_date})
            query.is_valid(raise_exception=True)
            closures = closures.filter(closed_for=query.validated_data["date"])
        return Response(CashRegisterClosureSerializer(closures, many=True).data)

    @extend_schema(
        request=CashRegisterClosureCreateSerializer,
        responses={201: CashRegisterClosureSerializer},
    )
    def post(self, request):
        serializer = CashRegisterClosureCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        values = serializer.validated_data
        target_date = values.get("closed_for", timezone.localdate())
        totals = services.payment_totals_for_date(target_date)
        expected_cash = {
            row["currency"]: str(row["net_collected"])
            for row in totals
            if row["payment_method"] == "cash"
        }
        try:
            with transaction.atomic():
                closure = CashRegisterClosure.objects.create(
                    closed_for=target_date,
                    closed_by=request.user,
                    expected_totals=[
                        {
                            **row,
                            "gross_collected": str(row["gross_collected"]),
                            "refunded": str(row["refunded"]),
                            "net_collected": str(row["net_collected"]),
                        }
                        for row in totals
                    ],
                    expected_cash=expected_cash,
                    counted_cash={
                        currency: str(amount)
                        for currency, amount in values["counted_cash"].items()
                    },
                    notes=values.get("notes", ""),
                )
        except IntegrityError:
            return Response(
                {"detail": "Une clôture existe déjà pour cet utilisateur et cette date."},
                status=status.HTTP_409_CONFLICT,
            )
        audit.log(
            actor=request.user,
            action="payment.cash_register_closed",
            resource=closure,
            metadata={"closed_for": target_date.isoformat()},
        )
        return Response(
            CashRegisterClosureSerializer(closure).data,
            status=status.HTTP_201_CREATED,
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
