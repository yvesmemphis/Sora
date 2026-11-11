from typing import ClassVar

from django.contrib.auth import get_user_model
from rest_framework import mixins
from rest_framework.response import Response
from rest_framework.viewsets import GenericViewSet

from common.constants import Role
from common.permissions import RolePermission

from . import services
from .serializers import StaffInviteSerializer, StaffSerializer, StaffUpdateSerializer

User = get_user_model()


class StaffViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, GenericViewSet):
    queryset = User.objects.order_by("email")
    serializer_class = StaffSerializer
    permission_classes: ClassVar[list] = [RolePermission]
    role_map: ClassVar[dict[str, set[Role]]] = {
        "list": {Role.ADMIN},
        "retrieve": {Role.ADMIN},
        "create": {Role.ADMIN},
        "partial_update": {Role.ADMIN},
    }
    auth_view = True

    def create(self, request):
        serializer = StaffInviteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = services.invite_staff(actor=request.user, **serializer.validated_data)
        return Response(StaffSerializer(user).data, status=201)

    def partial_update(self, request, pk=None):
        target = self.get_object()
        serializer = StaffUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = services.change_staff(
            target=target,
            actor=request.user,
            **serializer.validated_data,
        )
        return Response(StaffSerializer(user).data)
