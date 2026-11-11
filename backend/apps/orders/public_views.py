from drf_spectacular.utils import extend_schema
from rest_framework import serializers, status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from apps.locations.models import Location
from common.constants import OrderMode

from . import services
from .public_serializers import (
    PublicOrderResponseSerializer,
    PublicOrderSerializer,
    TrackOrderSerializer,
)
from .tracking import make_tracking_token, order_from_tracking_token


class PublicOrderCreateView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "public_order"
    public = True

    @extend_schema(
        request=PublicOrderSerializer,
        responses={
            200: PublicOrderResponseSerializer,
            201: PublicOrderResponseSerializer,
        },
    )
    def post(self, request):
        serializer = PublicOrderSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        values = serializer.validated_data
        idempotency_key = request.headers.get("Idempotency-Key")
        if idempotency_key is not None and (
            not idempotency_key.strip() or len(idempotency_key) > 64
        ):
            raise serializers.ValidationError(
                {"Idempotency-Key": "La clé doit contenir de 1 à 64 caractères."}
            )

        location = None
        location_ref = values.get("location")
        if location_ref:
            location = Location.objects.filter(
                is_active=True,
                type=location_ref["type"],
                reference=location_ref["reference"],
            ).first()
            if location is None:
                raise serializers.ValidationError(
                    {"location": "Emplacement inconnu ou inactif."}
                )
        elif values["mode"] in {OrderMode.DINE_IN, OrderMode.ROOM}:
            raise serializers.ValidationError(
                {"location": "Un emplacement est requis pour ce mode."}
            )

        order, created = services.create_public_order(
            items=[dict(item) for item in values["items"]],
            mode=values["mode"],
            location=location,
            note=values.get("note", ""),
            idempotency_key=idempotency_key,
        )
        return Response(
            {
                "number": order.number,
                "total": str(order.total),
                "tracking_token": make_tracking_token(order),
            },
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )


class PublicTrackView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "public_track"
    public = True

    @extend_schema(responses=TrackOrderSerializer)
    def get(self, request, token):
        order = order_from_tracking_token(token)
        response = Response(TrackOrderSerializer(order).data)
        response["Referrer-Policy"] = "no-referrer"
        return response
