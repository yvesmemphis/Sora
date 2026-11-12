from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from common.constants import ALL_ROLES, MANAGERS, Role
from common.pagination import StandardPagination
from common.permissions import RolePermission

from . import services
from .models import Order
from .serializers import (
    KitchenOrderSerializer,
    OrderCreateSerializer,
    OrderListQuerySerializer,
    OrderLocationSerializer,
    OrderSerializer,
    OrderTransitionSerializer,
)


class OrderViewSet(viewsets.ViewSet):
    permission_classes = [RolePermission]
    serializer_class = OrderSerializer
    queryset = Order.objects.all()
    lookup_value_regex = r"\d+"
    role_map = {
        "list": ALL_ROLES,
        "retrieve": ALL_ROLES,
        "create": MANAGERS | {Role.WAITER},
        "transition": ALL_ROLES,
        "location": MANAGERS | {Role.WAITER},
    }

    def get_serializer_class(self):
        if getattr(self.request.user, "role", None) == Role.KITCHEN:
            return KitchenOrderSerializer
        return OrderSerializer

    def _orders(self):
        queryset = (
            Order.objects.select_related("location")
            .prefetch_related("items", "status_history", "payments__refunds")
        )
        role = self.request.user.role
        if role in MANAGERS:
            return queryset
        if role == Role.WAITER:
            return services.waiter_orders(queryset, self.request.user)
        if role == Role.KITCHEN:
            return queryset.filter(
                status__in=["CONFIRMED", "PREPARING", "READY"]
            )
        return queryset.none()

    @extend_schema(
        operation_id="orders_list",
        parameters=[
            OpenApiParameter("status", str, OpenApiParameter.QUERY),
            OpenApiParameter("date", str, OpenApiParameter.QUERY),
            OpenApiParameter("created_after", str, OpenApiParameter.QUERY),
            OpenApiParameter("page", int, OpenApiParameter.QUERY),
            OpenApiParameter("page_size", int, OpenApiParameter.QUERY),
        ],
        responses=OrderSerializer(many=True),
        description=(
            "Filtrer par statut, date ou date de création. L'envoi de page ou "
            "page_size active la pagination; sans ces paramètres la réponse "
            "reste une liste pour compatibilité."
        ),
    )
    def list(self, request):
        query_serializer = OrderListQuerySerializer(data=request.query_params)
        query_serializer.is_valid(raise_exception=True)
        filters = query_serializer.validated_data
        queryset = self._orders()
        if "status" in filters:
            queryset = queryset.filter(status=filters["status"])
        if "date" in filters:
            queryset = queryset.filter(created_at__date=filters["date"])
        if "created_after" in filters:
            queryset = queryset.filter(created_at__gt=filters["created_after"])
        if "page" in filters or "page_size" in filters:
            paginator = StandardPagination()
            page = paginator.paginate_queryset(queryset, request, view=self)
            serializer = self.get_serializer_class()(page, many=True)
            return paginator.get_paginated_response(serializer.data)
        serializer = self.get_serializer_class()(queryset, many=True)
        return Response(serializer.data)

    @extend_schema(operation_id="orders_retrieve", responses=OrderSerializer)
    def retrieve(self, request, pk=None):
        order = self._orders().filter(pk=pk).first()
        if order is None:
            return Response({"detail": "Commande introuvable."}, status=404)
        serializer = self.get_serializer_class()(order)
        return Response(serializer.data)

    @extend_schema(request=OrderCreateSerializer, responses={201: OrderSerializer})
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
    @extend_schema(request=OrderTransitionSerializer, responses=OrderSerializer)
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

    @action(methods=["patch"], detail=True, url_path="location")
    @extend_schema(request=OrderLocationSerializer, responses=OrderSerializer)
    def location(self, request, pk=None):
        serializer = OrderLocationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        order = services.change_order_location(
            order_id=pk,
            location=serializer.validated_data["location"],
            actor=request.user,
        )
        return Response(OrderSerializer(order).data)
