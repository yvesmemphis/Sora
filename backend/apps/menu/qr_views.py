from io import BytesIO
from urllib.parse import urlencode

import qrcode
from django.conf import settings
from django.http import HttpResponse
from django.urls import reverse
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema
from rest_framework import serializers
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from apps.locations.models import Location
from common.constants import MANAGERS, LocationType, OrderMode
from common.permissions import RolePermission


class MenuQrQuerySerializer(serializers.Serializer):
    mode = serializers.ChoiceField(choices=OrderMode.choices, default=OrderMode.TAKEAWAY)
    location_id = serializers.UUIDField(required=False)

    def validate(self, attrs):
        location_id = attrs.get("location_id")
        mode = attrs["mode"]
        expected_type = {
            OrderMode.DINE_IN: LocationType.TABLE,
            OrderMode.ROOM: LocationType.ROOM,
            OrderMode.TAKEAWAY: LocationType.TAKEAWAY,
        }[mode]
        if location_id:
            location = Location.objects.filter(pk=location_id, is_active=True).first()
            if location is None or location.type != expected_type:
                raise serializers.ValidationError(
                    {"location_id": "Emplacement inactif ou incompatible avec le mode."}
                )
            attrs["location"] = location
        elif mode in {OrderMode.DINE_IN, OrderMode.ROOM}:
            raise serializers.ValidationError(
                {"location_id": "Un emplacement est requis pour ce mode."}
            )
        return attrs


class MenuQrView(APIView):
    permission_classes = [IsAuthenticated, RolePermission]
    role_map = {"*": MANAGERS}

    @extend_schema(
        parameters=[MenuQrQuerySerializer],
        responses={(200, "image/png"): OpenApiTypes.BINARY},
    )
    def get(self, request):
        query = MenuQrQuerySerializer(data=request.query_params)
        query.is_valid(raise_exception=True)
        values = query.validated_data
        menu_api = request.build_absolute_uri(reverse("menu:public-menu"))
        # Le frontend ouvre la carte sur /menu et lit `table` ou `chambre`
        # (voir frontend/src/lib/client/menu.tsx).
        parameters = {}
        location = values.get("location")
        if location and location.type == LocationType.TABLE:
            parameters["table"] = location.reference
        elif location and location.type == LocationType.ROOM:
            parameters["chambre"] = location.reference
        parameters["mode"] = values["mode"]
        parameters["menu_api"] = menu_api
        target_url = f"{settings.FRONTEND_URL.rstrip('/')}/menu?{urlencode(parameters)}"

        image = qrcode.make(target_url)
        buffer = BytesIO()
        image.save(buffer, format="PNG")
        response = HttpResponse(buffer.getvalue(), content_type="image/png")
        response["Content-Disposition"] = 'inline; filename="menu-qr.png"'
        response["Cache-Control"] = "no-store"
        response["X-QR-Target"] = target_url
        return response
