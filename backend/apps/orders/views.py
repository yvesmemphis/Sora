from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from common.constants import ALL_ROLES, MANAGERS, Role
from common.permissions import RolePermission

from . import services
from .models import Order
from .serializers import (
    KitchenOrderSerializer,
    OrderCreateSerializer,
    OrderSerializer,
    OrderTransitionSerializer,
)


class OrderViewSet(viewsets.ViewSet):
    permission_classes = [RolePermission]
    role_map = {
        "list": ALL_ROLES,
        "retrieve": ALL_ROLES,
        "create": MANAGERS | {Role.WAITER},
        "transition": ALL_ROLES,
    }

    def get_serializer_class(self):
        if self.request.user.role == Role.KITCHEN:
            return KitchenOrderSerializer
        return OrderSerializer

    def _orders(self):
        queryset = Order.objects.prefetch_related("items")
        role = self.request.user.role
        if role in MANAGERS:
            return queryset
        if role == Role.WAITER:
            return queryset.filter(created_by=self.request.user)
        if role == Role.KITCHEN:
            return queryset.filter(
                status__in=["CONFIRMED", "PREPARING", "READY"]
            )
        return queryset.none()

    def list(self, request):
        serializer = self.get_serializer_class()(self._orders(), many=True)
        return Response(serializer.data)

    def retrieve(self, request, pk=None):
        order = self._orders().filter(pk=pk).first()
        if order is None:
            return Response({"detail": "Commande introuvable."}, status=404)
        serializer = self.get_serializer_class()(order)
        return Response(serializer.data)

    def create(self, request):
        serializer = OrderCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        key = request.headers.get("Idempotency-Key")
        if key is not None and (not key.strip() or len(key) > 64):
            return Response(
                {"detail": "Idempotency-Key doit contenir de 1 à 64 caractères."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        order, created = services.create_order(
            serializer.validated_data,
            user=request.user,
            idempotency_key=key,
        )
        response_status = status.HTTP_201_CREATED if created else status.HTTP_200_OK
        headers = {} if created else {"X-Idempotency-Repeat": "true"}
        return Response(OrderSerializer(order).data, status=response_status, headers=headers)

    @action(methods=["post"], detail=True, url_path="transition")
    def transition(self, request, pk=None):
        serializer = OrderTransitionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        order = services.transition_order(
            pk,
            serializer.validated_data["status"],
            actor=request.user,
            note=serializer.validated_data.get("note", ""),
        )
        return Response(self.get_serializer_class()(order).data)
