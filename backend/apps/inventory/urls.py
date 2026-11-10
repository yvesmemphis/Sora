# urls.py pour l'app Inventory (Dev 2)

from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    IngredientViewSet,
    InventoryAlertViewSet,
    RecipeConsumptionViewSet,
    RecipeItemViewSet,
    RecipeVersionViewSet,
    StockLotViewSet,
    StockMovementViewSet,
    SupplierViewSet,
)

app_name = "inventory"

router = DefaultRouter()
router.register(r"suppliers", SupplierViewSet, basename="supplier")
router.register(r"ingredients", IngredientViewSet, basename="ingredient")
router.register(r"stock-lots", StockLotViewSet, basename="stock-lot")
router.register(r"stock-movements", StockMovementViewSet, basename="stock-movement")
router.register(r"inventory-alerts", InventoryAlertViewSet, basename="inventory-alert")
router.register(r"recipe-versions", RecipeVersionViewSet, basename="recipe-version")
router.register(r"recipe-items", RecipeItemViewSet, basename="recipe-item")
router.register(r"recipe-consumptions", RecipeConsumptionViewSet, basename="recipe-consumption")

urlpatterns = [
    path("", include(router.urls)),
]