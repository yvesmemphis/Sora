from drf_spectacular.utils import extend_schema
from rest_framework import serializers
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from apps.core.models import RestaurantSettings

from .models import Dish


class PublicDishSerializer(serializers.ModelSerializer):
    category = serializers.CharField(source="category.name", read_only=True)

    class Meta:
        model = Dish
        fields = [
            "id",
            "name",
            "description",
            "price",
            "allergens",
            "image",
            "category",
            "is_available",
            "preparation_time",
        ]


class PublicMenuResponseSerializer(serializers.Serializer):
    name = serializers.CharField()
    ordering_enabled = serializers.BooleanField()
    dishes = PublicDishSerializer(many=True)


class PublicMenuView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "public_menu"
    public = True

    @extend_schema(responses=PublicMenuResponseSerializer)
    def get(self, request):
        settings = RestaurantSettings.load()
        dishes = (
            Dish.objects.filter(
                is_published=True,
                category__is_active=True,
            )
            .select_related("category")
            .order_by("category__position", "name")
        )
        response = Response(
            {
                "name": settings.name,
                "ordering_enabled": settings.public_ordering_enabled,
                "dishes": PublicDishSerializer(
                    dishes, many=True, context={"request": request}
                ).data,
            }
        )
        response["Cache-Control"] = "public, max-age=30"
        response["Referrer-Policy"] = "no-referrer"
        return response
