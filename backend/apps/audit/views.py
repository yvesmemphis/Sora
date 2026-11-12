from django.db.models import Q
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


class AuditQuerySerializer(serializers.Serializer):
    date_from = serializers.DateField(required=False)
    date_to = serializers.DateField(required=False)
    actor = serializers.IntegerField(min_value=1, required=False)
    module = serializers.CharField(max_length=100, required=False)
    action = serializers.CharField(max_length=100, required=False)
    result = serializers.CharField(max_length=10, required=False)
    page = serializers.IntegerField(min_value=1, required=False)
    page_size = serializers.IntegerField(min_value=1, max_value=100, required=False)

    def validate(self, attrs):
        date_from = attrs.get("date_from")
        date_to = attrs.get("date_to")
        if date_from and date_to and date_from > date_to:
            raise serializers.ValidationError(
                {
                    "date_to": (
                        "La date de fin doit être postérieure ou égale "
                        "à la date de début."
                    )
                }
            )
        return attrs


class AuditViewSet(ReadOnlyModelViewSet):
    queryset = AuditEvent.objects.select_related("actor").order_by("-created_at")
    serializer_class = AuditEventSerializer
    permission_classes = [RolePermission]
    role_map = {"list": {Role.ADMIN}, "retrieve": {Role.ADMIN}}

    def filter_queryset(self, queryset):
        serializer = AuditQuerySerializer(data=self.request.query_params)
        serializer.is_valid(raise_exception=True)
        filters = serializer.validated_data
        if "date_from" in filters:
            queryset = queryset.filter(created_at__date__gte=filters["date_from"])
        if "date_to" in filters:
            queryset = queryset.filter(created_at__date__lte=filters["date_to"])
        if "actor" in filters:
            queryset = queryset.filter(actor_id=filters["actor"])
        if "module" in filters:
            module = filters["module"]
            queryset = queryset.filter(
                Q(resource_type__startswith=f"apps.{module}.")
                | Q(action__startswith=f"{module.rstrip('s')}.")
            )
        if "action" in filters:
            queryset = queryset.filter(action__icontains=filters["action"])
        if "result" in filters:
            queryset = queryset.filter(result=filters["result"])
        return queryset
