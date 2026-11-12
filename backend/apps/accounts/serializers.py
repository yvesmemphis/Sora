from typing import ClassVar

from django.contrib.auth import get_user_model
from rest_framework import serializers

from common.constants import Role

User = get_user_model()


class MeSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields: ClassVar[list[str]] = ["id", "email", "first_name", "last_name", "role"]


class PasswordResetRequestSerializer(serializers.Serializer):
    email = serializers.EmailField()


class PasswordResetConfirmSerializer(serializers.Serializer):
    uid = serializers.CharField()
    token = serializers.CharField()
    new_password = serializers.CharField(write_only=True)


class StaffSerializer(serializers.ModelSerializer):
    is_invited = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields: ClassVar[list[str]] = [
            "id",
            "email",
            "first_name",
            "last_name",
            "role",
            "is_active",
            "is_invited",
        ]
        read_only_fields: ClassVar[list[str]] = ["id", "is_active"]

    def get_is_invited(self, obj) -> bool:
        return not obj.has_usable_password()


class StaffInviteSerializer(serializers.Serializer):
    email = serializers.EmailField()
    first_name = serializers.CharField(max_length=60, required=False, allow_blank=True)
    last_name = serializers.CharField(max_length=60, required=False, allow_blank=True)
    role = serializers.ChoiceField(choices=Role.choices)


class StaffUpdateSerializer(serializers.Serializer):
    role = serializers.ChoiceField(choices=Role.choices, required=False)
    is_active = serializers.BooleanField(required=False)
