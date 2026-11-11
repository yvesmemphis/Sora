from rest_framework import serializers
from rest_framework.viewsets import ReadOnlyModelViewSet

from common.constants import Role
from common.permissions import RolePermission

from .models import AuditEvent


class AuditEventSerializer(serializers.ModelSerializer):
    actor_email = serializers.EmailField(
        source="actor.email", read_only=True, default=None
    )

    class Meta:
        model = AuditEvent
        fields = [
            "id",
            "created_at",
            "actor_email",
            "action",
            "resource_type",
            "resource_id",
            "result",
            "metadata",
        ]


class AuditViewSet(ReadOnlyModelViewSet):
    queryset = AuditEvent.objects.select_related("actor").order_by("-created_at")
    serializer_class = AuditEventSerializer
    permission_classes = [RolePermission]
    role_map = {"list": {Role.ADMIN}, "retrieve": {Role.ADMIN}}
    filterset_fields = ["action", "result"]
