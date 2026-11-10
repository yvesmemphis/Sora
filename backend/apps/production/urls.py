from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import ProductionBatchViewSet, WasteDeclarationViewSet

app_name = "production"

router = DefaultRouter()
router.register(
    "production-batches", ProductionBatchViewSet, basename="production-batch"
)
router.register(
    "waste-declarations", WasteDeclarationViewSet, basename="waste-declaration"
)

urlpatterns = [path("", include(router.urls))]
