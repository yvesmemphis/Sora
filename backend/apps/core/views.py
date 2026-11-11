from rest_framework import serializers
from rest_framework.response import Response
from rest_framework.viewsets import ViewSet

from apps.audit import services as audit
from common.constants import ALL_ROLES, Role
from common.permissions import RolePermission

from .models import RestaurantSettings


class SettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = RestaurantSettings
        fields = [
            "name",
            "auto_confirm_orders",
            "public_ordering_enabled",
            "expiry_alert_days",
        ]


class SettingsViewSet(ViewSet):
    permission_classes = [RolePermission]
    serializer_class = SettingsSerializer
    role_map = {"retrieve": ALL_ROLES, "partial_update": {Role.ADMIN}}

    def retrieve(self, request):
        return Response(SettingsSerializer(RestaurantSettings.load()).data)

    def partial_update(self, request):
        settings = RestaurantSettings.load()
        serializer = SettingsSerializer(settings, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        audit.log(
            actor=request.user,
            action="settings.change",
            resource=settings,
            metadata=serializer.validated_data,
        )
        return Response(serializer.data)
