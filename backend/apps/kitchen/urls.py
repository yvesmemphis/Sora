# urls.py pour l'app Kitchen (Dev 2)

from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import KitchenQueueViewSet, KitchenTicketViewSet

app_name = "kitchen"

router = DefaultRouter()
router.register(r"kitchen/queue", KitchenQueueViewSet, basename="queue")
router.register(r"kitchen/tickets", KitchenTicketViewSet, basename="kitchen-ticket")

urlpatterns = [
    path("", include(router.urls)),
]