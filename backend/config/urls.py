"""
URL configuration for config project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/6.1/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""

from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.core.cache import cache
from django.db import connection
from django.http import JsonResponse
from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView
from rest_framework.permissions import AllowAny, IsAdminUser

from apps.audit.views import AuditExportView, AuditViewSet
from apps.core.views import SettingsViewSet

schema_permission = AllowAny if settings.DEBUG else IsAdminUser


def health(request):
    connection.ensure_connection()
    cache.set("health", 1, timeout=5)
    return JsonResponse({"status": "ok"})


urlpatterns = [
    path("admin/", admin.site.urls),
    path("health/", health, name="health"),
    path("api/v1/", include("apps.accounts.urls")),
    path("api/v1/", include("apps.menu.urls")),
    path("api/v1/", include("apps.locations.urls")),
    path(
        "api/v1/settings/",
        SettingsViewSet.as_view({"get": "retrieve", "patch": "partial_update"}),
        name="settings",
    ),
    path(
        "api/v1/audit/export/",
        AuditExportView.as_view(),
        name="audit-export",
    ),
    path(
        "api/v1/audit/",
        AuditViewSet.as_view({"get": "list"}),
        name="audit-list",
    ),
    path(
        "api/v1/audit/<uuid:pk>/",
        AuditViewSet.as_view({"get": "retrieve"}),
        name="audit-detail",
    ),
    path("api/v1/", include("apps.orders.urls")),
    path("api/v1/", include("apps.kitchen.urls")),
    path("api/v1/", include("apps.payments.urls")),
    path("api/v1/", include("apps.inventory.urls")),
    path("api/v1/", include("apps.production.urls")),
    path("api/v1/", include("apps.analytics.urls")),
    path(
        "api/v1/schema/",
        SpectacularAPIView.as_view(permission_classes=[schema_permission]),
        name="schema",
    ),
    path(
        "api/v1/docs/",
        SpectacularSwaggerView.as_view(url_name="schema"),
        name="docs",
    ),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
