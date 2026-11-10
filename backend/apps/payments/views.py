from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.orders.models import Order
from common.constants import MANAGERS, Role

from . import services
from .models import Payment
from .serializers import (
    PaymentCreateSerializer,
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
    return user.role == Role.WAITER and order.created_by_id == user.pk


class OrderPaymentsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, order_id):
        _require_roles(request.user, MANAGERS | {Role.WAITER})
        order = get_object_or_404(Order, pk=order_id)
        if not _can_access_order(request.user, order):
            raise PermissionDenied("Commande non accessible.")
        payments = Payment.objects.filter(order=order).order_by("-created_at")
        serializer_class = (
            PaymentSerializer if request.user.role in MANAGERS else PaymentSummarySerializer
        )
        return Response(serializer_class(payments, many=True).data)

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


class PaymentRefundsView(APIView):
    permission_classes = [IsAuthenticated]

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
    permission_classes = [IsAuthenticated]

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
