import csv
import io
import json

from django.db.models import Q
from django.http import StreamingHttpResponse
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema
from rest_framework import serializers
from rest_framework.views import APIView
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
        return filter_audit_queryset(queryset, self.request.query_params)


def filter_audit_queryset(queryset, query_params):
    serializer = AuditQuerySerializer(data=query_params)
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
            # `audit.log` enregistre `_meta.label_lower` (ex. « orders.order ») ;
            # l'ancien préfixe « apps. » reste reconnu.
            Q(resource_type__startswith=f"{module}.")
            | Q(resource_type__startswith=f"apps.{module}.")
            | Q(action__startswith=f"{module}.")
        )
    if "action" in filters:
        queryset = queryset.filter(action__icontains=filters["action"])
    if "result" in filters:
        queryset = queryset.filter(result=filters["result"])
    return queryset


class _CsvBuffer:
    def write(self, value):
        return value


def _safe_csv_value(value):
    if isinstance(value, str) and value.startswith(("=", "+", "-", "@")):
        return f"'{value}"
    return value


class AuditExportView(APIView):
    permission_classes = [RolePermission]
    role_map = {"*": {Role.ADMIN}}

    @extend_schema(
        responses={(200, "text/csv"): OpenApiTypes.BINARY},
        description="Exporte le journal filtré au format CSV.",
    )
    def get(self, request):
        queryset = filter_audit_queryset(
            AuditEvent.objects.select_related("actor").order_by("created_at"),
            request.query_params,
        )

        def rows():
            buffer = _CsvBuffer()
            writer = csv.writer(buffer)
            yield writer.writerow(
                [
                    "id",
                    "created_at",
                    "actor_email",
                    "action",
                    "resource_type",
                    "resource_id",
                    "result",
                    "metadata",
                ]
            )
            for event in queryset.iterator(chunk_size=500):
                output = io.StringIO(newline="")
                writer = csv.writer(output)
                writer.writerow(
                    [
                        event.pk,
                        event.created_at.isoformat(),
                        _safe_csv_value(event.actor.email if event.actor_id else ""),
                        _safe_csv_value(event.action),
                        _safe_csv_value(event.resource_type),
                        _safe_csv_value(event.resource_id),
                        _safe_csv_value(event.result),
                        _safe_csv_value(
                            json.dumps(
                                event.metadata, ensure_ascii=False, sort_keys=True
                            )
                        ),
                    ]
                )
                yield output.getvalue()

        response = StreamingHttpResponse(rows(), content_type="text/csv; charset=utf-8")
        response["Content-Disposition"] = 'attachment; filename="journal-audit.csv"'
        return response
