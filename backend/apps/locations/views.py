from rest_framework import mixins, serializers, viewsets

from common.constants import ALL_ROLES, MANAGERS
from common.permissions import RolePermission

from .models import Location


class LocationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Location
        fields = ["id", "type", "reference", "is_active"]
        read_only_fields = ["id"]


class LocationViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.CreateModelMixin,
    mixins.UpdateModelMixin,
    viewsets.GenericViewSet,
):
    queryset = Location.objects.all()
    serializer_class = LocationSerializer
    permission_classes = [RolePermission]
    filterset_fields = ["type", "is_active"]
    role_map = {
        "list": ALL_ROLES,
        "retrieve": ALL_ROLES,
        "create": MANAGERS,
        "update": MANAGERS,
        "partial_update": MANAGERS,
    }

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)
