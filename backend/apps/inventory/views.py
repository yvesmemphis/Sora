from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from common.constants import ALL_ROLES, MANAGERS
from common.permissions import RolePermission

from . import services
from .models import (
    Ingredient,
    InventoryAlert,
    RecipeConsumption,
    RecipeItem,
    RecipeVersion,
    StockLot,
    StockMovement,
    Supplier,
)
from .serializers import (
    IngredientSerializer,
    IngredientStaffSerializer,
    InventoryAlertSerializer,
    RecipeConsumptionSerializer,
    RecipeItemSerializer,
    RecipePublishSerializer,
    RecipeVersionSerializer,
    StockAdjustmentSerializer,
    StockLotCreateSerializer,
    StockLotSerializer,
    StockMovementSerializer,
    StockWasteSerializer,
    SupplierSerializer,
)


class SupplierViewSet(viewsets.ModelViewSet):
    queryset = Supplier.objects.all()
    serializer_class = SupplierSerializer
    permission_classes = [RolePermission]
    role_map = {
        "list": MANAGERS,
        "retrieve": MANAGERS,
        "create": MANAGERS,
        "update": MANAGERS,
        "partial_update": MANAGERS,
    }

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class IngredientViewSet(viewsets.ModelViewSet):
    queryset = Ingredient.objects.select_related("supplier").all()
    permission_classes = [RolePermission]
    role_map = {
        "list": ALL_ROLES,
        "retrieve": ALL_ROLES,
        "create": MANAGERS,
        "update": MANAGERS,
        "partial_update": MANAGERS,
    }

    def get_serializer_class(self):
        if getattr(self.request.user, "role", None) in MANAGERS:
            return IngredientSerializer
        return IngredientStaffSerializer

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class StockLotViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet,
):
    queryset = StockLot.objects.select_related("ingredient", "supplier")
    serializer_class = StockLotSerializer
    permission_classes = [RolePermission]
    role_map = {
        "list": MANAGERS,
        "retrieve": MANAGERS,
        "create": MANAGERS,
        "adjust": MANAGERS,
        "waste": MANAGERS,
    }

    def create(self, request, *args, **kwargs):
        serializer = StockLotCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        lot = services.receive_lot(**serializer.validated_data, actor=request.user)
        return Response(
            StockLotSerializer(lot).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=["post"])
    def adjust(self, request, pk=None):
        lot = self.get_object()
        serializer = StockAdjustmentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        lot, movement = services.adjust_lot(
            lot_id=lot.pk,
            actor=request.user,
            **serializer.validated_data,
        )
        return Response(
            {
                **StockLotSerializer(lot).data,
                "movement_id": movement.pk if movement else None,
            }
        )

    @action(detail=True, methods=["post"])
    def waste(self, request, pk=None):
        lot = self.get_object()
        serializer = StockWasteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        movement = services.declare_lot_waste(
            lot_id=lot.pk,
            actor=request.user,
            **serializer.validated_data,
        )
        return Response(
            StockMovementSerializer(movement).data,
            status=status.HTTP_201_CREATED,
        )


class StockMovementViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = StockMovement.objects.select_related(
        "lot",
        "lot__ingredient",
        "noted_by",
        "reference_order",
    )
    serializer_class = StockMovementSerializer
    permission_classes = [RolePermission]
    role_map = {"list": MANAGERS, "retrieve": MANAGERS}


class InventoryAlertViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = InventoryAlert.objects.select_related("ingredient", "stock_lot")
    serializer_class = InventoryAlertSerializer
    permission_classes = [RolePermission]
    role_map = {"list": MANAGERS, "retrieve": MANAGERS}


class RecipeVersionViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet,
):
    queryset = RecipeVersion.objects.prefetch_related("items__ingredient").all()
    serializer_class = RecipeVersionSerializer
    permission_classes = [RolePermission]
    role_map = {
        "list": MANAGERS,
        "retrieve": MANAGERS,
        "active": MANAGERS,
        "publish": MANAGERS,
    }

    @action(detail=False, methods=["get"])
    def active(self, request):
        menu_item_id = request.query_params.get("menu_item_id")
        if not menu_item_id:
            return Response(
                {"detail": "Le paramètre menu_item_id est requis."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        recipe = self.get_queryset().filter(
            menu_item_id=menu_item_id,
            is_active=True,
        ).first()
        if recipe is None:
            return Response({"detail": "Aucune recette active."}, status=404)
        return Response(self.get_serializer(recipe).data)

    @action(detail=False, methods=["post"])
    def publish(self, request):
        serializer = RecipePublishSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        recipe = services.publish_recipe_version(
            **serializer.validated_data,
            actor=request.user,
        )
        return Response(
            self.get_serializer(recipe).data,
            status=status.HTTP_201_CREATED,
        )


class RecipeItemViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = RecipeItem.objects.select_related(
        "recipe_version", "ingredient"
    )
    serializer_class = RecipeItemSerializer
    permission_classes = [RolePermission]
    role_map = {"list": MANAGERS, "retrieve": MANAGERS}


class RecipeConsumptionViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = RecipeConsumption.objects.select_related("recipe_version", "order")
    serializer_class = RecipeConsumptionSerializer
    permission_classes = [RolePermission]
    role_map = {"list": MANAGERS, "retrieve": MANAGERS}
