
from typing import ClassVar

from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.contrib.auth.tokens import default_token_generator
from django.core.exceptions import ValidationError as DjangoValidationError
from django.utils.decorators import method_decorator
from django.utils.encoding import force_str
from django.utils.http import urlsafe_base64_decode
from django.views.decorators.csrf import csrf_protect, ensure_csrf_cookie
from drf_spectacular.utils import extend_schema
from rest_framework import serializers
from rest_framework.exceptions import AuthenticationFailed
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from . import services
from .serializers import (
    MeSerializer,
    PasswordResetConfirmSerializer,
    PasswordResetRequestSerializer,
)

User = get_user_model()


class LogoutSerializer(serializers.Serializer):
    refresh = serializers.CharField(required=False, allow_blank=True)


@method_decorator(ensure_csrf_cookie, name="dispatch")
class LoginView(TokenObtainPairView):
    throttle_classes: ClassVar[list] = [ScopedRateThrottle]
    throttle_scope = "login"
    auth_view = True

    def post(self, request, *args, **kwargs):
        response = super().post(request, *args, **kwargs)
        if response.status_code == 200:
            refresh = response.data.pop("refresh", None)
            if refresh:
                _set_refresh_cookie(response, refresh)
        return response


@method_decorator(csrf_protect, name="dispatch")
class RefreshView(TokenRefreshView):
    throttle_classes: ClassVar[list] = [ScopedRateThrottle]
    throttle_scope = "login"
    auth_view = True

    def post(self, request, *args, **kwargs):
        refresh = request.data.get("refresh") or request.COOKIES.get(
            settings.JWT_REFRESH_COOKIE_NAME
        )
        if not refresh:
            raise AuthenticationFailed("Jeton de rafraîchissement manquant.")
        serializer = self.get_serializer(data={"refresh": refresh})
        serializer.is_valid(raise_exception=True)
        response = Response(serializer.validated_data)
        rotated_refresh = response.data.pop("refresh", refresh)
        _set_refresh_cookie(response, rotated_refresh)
        return response


@method_decorator(csrf_protect, name="dispatch")
class LogoutView(APIView):
    permission_classes: ClassVar[list] = [IsAuthenticated]
    auth_view = True

    @extend_schema(request=LogoutSerializer, responses={204: None})
    def post(self, request):
        refresh = request.data.get("refresh") or request.COOKIES.get(
            settings.JWT_REFRESH_COOKIE_NAME
        )
        try:
            if refresh:
                RefreshToken(refresh).blacklist()
        except TokenError:
            pass
        response = Response(status=204)
        response.delete_cookie(
            settings.JWT_REFRESH_COOKIE_NAME,
            path=settings.JWT_REFRESH_COOKIE_PATH,
            samesite=settings.JWT_REFRESH_COOKIE_SAMESITE,
        )
        return response


def _set_refresh_cookie(response, token):
    lifetime = settings.SIMPLE_JWT["REFRESH_TOKEN_LIFETIME"]
    response.set_cookie(
        settings.JWT_REFRESH_COOKIE_NAME,
        token,
        max_age=int(lifetime.total_seconds()),
        httponly=True,
        secure=settings.JWT_REFRESH_COOKIE_SECURE,
        samesite=settings.JWT_REFRESH_COOKIE_SAMESITE,
        path=settings.JWT_REFRESH_COOKIE_PATH,
    )


class MeView(APIView):
    permission_classes: ClassVar[list] = [IsAuthenticated]
    auth_view = True

    @extend_schema(responses=MeSerializer)
    def get(self, request):
        return Response(MeSerializer(request.user).data)


class PasswordResetRequestView(APIView):
    authentication_classes: ClassVar[list] = []
    permission_classes: ClassVar[list] = [AllowAny]
    throttle_classes: ClassVar[list] = [ScopedRateThrottle]
    throttle_scope = "password_reset"
    auth_view = True

    @extend_schema(request=PasswordResetRequestSerializer, responses={202: None})
    def post(self, request):
        serializer = PasswordResetRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = User.objects.filter(
            email__iexact=serializer.validated_data["email"],
            is_active=True,
        ).first()
        if user:
            services.send_password_email(user, invited=False)
        return Response(status=202)


class PasswordResetConfirmView(APIView):
    authentication_classes: ClassVar[list] = []
    permission_classes: ClassVar[list] = [AllowAny]
    throttle_classes: ClassVar[list] = [ScopedRateThrottle]
    throttle_scope = "password_reset"
    auth_view = True

    @extend_schema(request=PasswordResetConfirmSerializer, responses={204: None})
    def post(self, request):
        serializer = PasswordResetConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            user = User.objects.get(
                pk=force_str(
                    urlsafe_base64_decode(serializer.validated_data["uid"])
                ),
                is_active=True,
            )
        except (User.DoesNotExist, ValueError, TypeError, OverflowError):
            raise serializers.ValidationError(
                {"token": "Lien invalide ou expiré."}
            ) from None

        if not default_token_generator.check_token(
            user, serializer.validated_data["token"]
        ):
            raise serializers.ValidationError(
                {"token": "Lien invalide ou expiré."}
            )

        try:
            validate_password(serializer.validated_data["new_password"], user)
        except DjangoValidationError as exc:
            raise serializers.ValidationError(
                {"new_password": list(exc.messages)}
            ) from exc

        user.set_password(serializer.validated_data["new_password"])
        user.save(update_fields=["password"])
        return Response(status=204)
