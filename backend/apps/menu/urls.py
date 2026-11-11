from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .public_views import PublicMenuView
from .views import CategoryViewSet, DishViewSet

app_name = "menu"

router = DefaultRouter()
router.register("categories", CategoryViewSet, basename="category")
router.register("dishes", DishViewSet, basename="dish")

urlpatterns = [
    path("public/menu/", PublicMenuView.as_view(), name="public-menu"),
    path("", include(router.urls)),
]
