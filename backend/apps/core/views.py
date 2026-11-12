import re

from rest_framework import serializers
from rest_framework.response import Response
from rest_framework.viewsets import ViewSet

from apps.audit import services as audit
from common.constants import ALL_ROLES, PAYMENT_METHOD_CHOICES, Role
from common.permissions import RolePermission

from .models import RestaurantSettings

WEEKDAYS = {"monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"}
TIME_PATTERN = re.compile(r"^(?:[01]\d|2[0-3]):[0-5]\d$")


class SettingsSerializer(serializers.ModelSerializer):
    accepted_payment_methods = serializers.ListField(
        child=serializers.ChoiceField(choices=PAYMENT_METHOD_CHOICES)
    )
    opening_hours = serializers.DictField(required=False)

    class Meta:
        model = RestaurantSettings
        fields = [
            "name",
            "auto_confirm_orders",
            "public_ordering_enabled",
            "withdrawal_delay_minutes",
            "expiry_alert_days",
            "opening_hours",
            "accepted_payment_methods",
            "currency",
        ]

    def validate_accepted_payment_methods(self, value):
        allowed = {method for method, _ in PAYMENT_METHOD_CHOICES}
        if not isinstance(value, list) or not value:
            raise serializers.ValidationError(
                "Au moins un mode de paiement doit être accepté."
            )
        if len(value) != len(set(value)) or set(value) - allowed:
            raise serializers.ValidationError("Modes de paiement invalides.")
        return value

    def validate_currency(self, value):
        value = value.upper()
        if len(value) != 3 or not value.isalpha() or not value.isascii():
            raise serializers.ValidationError("Utilisez un code devise ISO à 3 lettres.")
        return value

    def validate_opening_hours(self, value):
        unknown_days = set(value) - WEEKDAYS
        if unknown_days:
            raise serializers.ValidationError(
                {"days": f"Jours inconnus : {', '.join(sorted(unknown_days))}."}
            )
        for day, schedule in value.items():
            if schedule == {"closed": True}:
                continue
            periods = schedule if isinstance(schedule, list) else [schedule]
            if not periods:
                raise serializers.ValidationError(
                    {day: "Indiquez au moins une plage horaire ou closed: true."}
                )
            for period in periods:
                if (
                    not isinstance(period, dict)
                    or set(period) != {"open", "close"}
                    or not all(
                        isinstance(period[key], str)
                        and TIME_PATTERN.fullmatch(period[key])
                        for key in ("open", "close")
                    )
                    or period["open"] == period["close"]
                ):
                    raise serializers.ValidationError(
                        {
                            day: (
                                "Chaque plage doit contenir open et close au "
                                "format HH:MM, ou closed: true."
                            )
                        }
                    )
        return value


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
