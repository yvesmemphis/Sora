from django.db.models import Q
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from rest_framework import status, viewsets
from rest_framework.response import Response

from common.constants import Role
from common.permissions import RolePermission

from . import services
from .models import KitchenQueueItem
from .serializers import KitchenQueueItemSerializer


class KitchenQueueViewSet(viewsets.ViewSet):
    permission_classes = [RolePermission]
    role_map = {"list": {Role.KITCHEN}}

    def list(self, request):
        queryset = (
            KitchenQueueItem.objects.select_related("order")
            .prefetch_related("order__items")
        )
        updated_after = request.query_params.get("updated_after")
        if updated_after:
            updated_after_dt = parse_datetime(updated_after)
            if updated_after_dt is None or not timezone.is_aware(updated_after_dt):
                return Response(
                    {"detail": "updated_after doit être une date ISO-8601 avec fuseau."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            queryset = queryset.filter(
                Q(status__in=["PREPARING", "READY"])
                | Q(status="SERVED", updated_at__gt=updated_after_dt)
            ).filter(updated_at__gt=updated_after_dt)
        else:
            queryset = queryset.filter(status__in=["PREPARING", "READY"])

        queryset = queryset.order_by("created_at", "pk")
        return Response(KitchenQueueItemSerializer(queryset, many=True).data)


class KitchenTicketViewSet(viewsets.ViewSet):
    permission_classes = [RolePermission]
    role_map = {"create": {Role.KITCHEN}}

    def create(self, request):
        ticket = services.generate_kitchen_ticket(user=request.user)
        return Response(
            {"ticket": ticket, "expires_in": services.TICKET_TTL_SECONDS},
            status=status.HTTP_201_CREATED,
        )
