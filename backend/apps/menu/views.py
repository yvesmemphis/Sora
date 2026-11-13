from decimal import Decimal

from rest_framework import mixins, serializers, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response

from apps.audit import services as audit
from common.constants import ALL_ROLES, MANAGERS, Role
from common.permissions import RolePermission

from .models import Category, Dish
from .validators import validate_image


class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ["id", "name", "position", "is_active"]
        read_only_fields = ["id"]


class DishSerializer(serializers.ModelSerializer):
    image = serializers.ImageField(
        required=False, allow_null=True, validators=[validate_image]
    )

    class Meta:
        model = Dish
        fields = [
            "id",
            "category",
            "name",
            "description",
            "price",
            "preparation_time",
            "allergens",
            "is_available",
            "availability_status",
            "is_published",
            "image",
        ]
        read_only_fields = ["id"]

    def validate(self, attrs):
        if "is_available" in attrs and "availability_status" in attrs:
            status_is_available = (
                attrs["availability_status"] == Dish.AvailabilityStatus.AVAILABLE
            )
            if attrs["is_available"] != status_is_available:
                raise serializers.ValidationError(
                    "is_available et availability_status sont incohérents."
                )
        return attrs

    def validate_category(self, value):
        if not value.is_active:
            raise serializers.ValidationError("La catégorie est inactive.")
        return value

    def validate_price(self, value):
        if value < 0 or value > Decimal(1_000_000):
            raise serializers.ValidationError("Prix invalide.")
        return value

    def update(self, instance, validated_data):
        old_price = instance.price
        if "availability_status" in validated_data:
            validated_data["is_available"] = (
                validated_data["availability_status"]
                == Dish.AvailabilityStatus.AVAILABLE
            )
        elif "is_available" in validated_data:
            validated_data["availability_status"] = (
                Dish.AvailabilityStatus.AVAILABLE
                if validated_data["is_available"]
                else Dish.AvailabilityStatus.TEMPORARILY_UNAVAILABLE
            )
        dish = super().update(instance, validated_data)
        if dish.price != old_price:
            audit.log(
                actor=self.context["request"].user,
                action="price.change",
                resource=dish,
                metadata={"old": str(old_price), "new": str(dish.price)},
            )
        return dish


class AvailabilitySerializer(serializers.Serializer):
    is_available = serializers.BooleanField(required=False)
    availability_status = serializers.ChoiceField(
        choices=Dish.AvailabilityStatus.choices, required=False
    )

    def validate(self, attrs):
        if "is_available" not in attrs and "availability_status" not in attrs:
            raise serializers.ValidationError(
                "Fournissez is_available ou availability_status."
            )
        if "is_available" in attrs and "availability_status" in attrs:
            status_is_available = (
                attrs["availability_status"] == Dish.AvailabilityStatus.AVAILABLE
            )
            if attrs["is_available"] != status_is_available:
                raise serializers.ValidationError(
                    "is_available et availability_status sont incohérents."
                )
        return attrs


class CategoryViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.CreateModelMixin,
    mixins.UpdateModelMixin,
    viewsets.GenericViewSet,
):
    queryset = Category.objects.all()
    serializer_class = CategorySerializer
    permission_classes = [RolePermission]
    role_map = {
        "list": ALL_ROLES,
        "retrieve": ALL_ROLES,
        "create": MANAGERS,
        "update": MANAGERS,
        "partial_update": MANAGERS,
    }

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class DishViewSet(viewsets.ModelViewSet):
    queryset = Dish.objects.select_related("category").all()
    serializer_class = DishSerializer
    permission_classes = [RolePermission]
    parser_classes = [JSONParser, MultiPartParser, FormParser]
    filterset_fields = [
        "category",
        "is_available",
        "availability_status",
        "is_published",
    ]
    role_map = {
        "list": ALL_ROLES,
        "retrieve": ALL_ROLES,
        "create": MANAGERS,
        "update": MANAGERS,
        "partial_update": MANAGERS,
        "destroy": MANAGERS,
        "set_availability": MANAGERS | {Role.KITCHEN},
    }

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    def perform_destroy(self, instance):
        instance.is_published = False
        instance.is_available = False
        instance.save(update_fields=["is_published", "is_available", "updated_at"])

    @action(detail=True, methods=["post"], url_path="availability")
    def set_availability(self, request, pk=None):
        dish = self.get_object()
        serializer = AvailabilitySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        availability_status = serializer.validated_data.get("availability_status")
        if availability_status is None:
            availability_status = (
                Dish.AvailabilityStatus.AVAILABLE
                if serializer.validated_data["is_available"]
                else Dish.AvailabilityStatus.TEMPORARILY_UNAVAILABLE
            )
        dish.availability_status = availability_status
        dish.save(update_fields=["availability_status", "updated_at"])
        return Response(
            DishSerializer(dish, context=self.get_serializer_context()).data
        )
