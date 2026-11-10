from django.urls import path

from .views import ForecastListView, ForecastReviewView, OverviewView

app_name = "analytics"

urlpatterns = [
    path("analytics/overview/", OverviewView.as_view(), name="overview"),
    path("analytics/forecasts/", ForecastListView.as_view(), name="forecast-list"),
    path(
        "analytics/forecasts/<int:pk>/<str:decision>/",
        ForecastReviewView.as_view(),
        name="forecast-review",
    ),
]
