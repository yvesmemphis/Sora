# urls.py pour le module Commandes (Dev 2)

from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .public_views import (
    PublicOrderCreateView,
    PublicTrackCancelView,
    PublicTrackQrView,
    PublicTrackView,
)
from .views import OrderViewSet

app_name = "orders"

router = DefaultRouter()
router.register(r"orders", OrderViewSet, basename="order")

urlpatterns = [
    path("public/orders/", PublicOrderCreateView.as_view(), name="public-order"),
    path(
        "public/track/<str:token>/cancel/",
        PublicTrackCancelView.as_view(),
        name="public-track-cancel",
    ),
    path(
        "public/track/<str:token>/qr/",
        PublicTrackQrView.as_view(),
        name="public-track-qr",
    ),
    path("public/track/<str:token>/", PublicTrackView.as_view(), name="public-track"),
    path("", include(router.urls)),
]
