
from datetime import date

from django.core.exceptions import ValidationError
from django.http import Http404
from django.utils import timezone
from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from common.constants import MANAGERS, Role

from . import services
from .models import Forecast
from .serializers import ForecastReviewSerializer, ForecastSerializer


def _date_parameter(value, fallback):
    if value is None:
        return fallback
    try:
        parsed = date.fromisoformat(value)
    except (TypeError, ValueError):
        raise ValidationError("Dates must use the YYYY-MM-DD format.")
    if parsed.isoformat() != value:
        raise ValidationError("Dates must use the YYYY-MM-DD format.")
    return parsed


class OverviewView(APIView):
    permission_classes = (IsAuthenticated,)

    def get(self, request):
        today = timezone.localdate()
        if getattr(request.user, "role", None) == Role.WAITER:
            return Response({"daily_order_count": services.daily_order_count(today)})
        try:
            start_date = _date_parameter(request.query_params.get("start_date"), today)
            end_date = _date_parameter(request.query_params.get("end_date"), today)
            data = services.overview(start_date, end_date)
        except ValidationError as exc:
            return Response({"detail": exc.messages}, status=status.HTTP_400_BAD_REQUEST)

        role = getattr(request.user, "role", None)
        if role == Role.KITCHEN:
            data.pop("revenue")
        return Response(data)


class ForecastListView(generics.ListAPIView):
    permission_classes = (IsAuthenticated,)
    serializer_class = ForecastSerializer
    queryset = Forecast.objects.all()

    def list(self, request, *args, **kwargs):
        if getattr(request.user, "role", None) not in MANAGERS:
            return Response(
                {"detail": "Only managers and administrators can access forecasts."},
                status=status.HTTP_403_FORBIDDEN,
            )
        return super().list(request, *args, **kwargs)


class ForecastReviewView(APIView):
    permission_classes = (IsAuthenticated,)

    def post(self, request, pk, decision):
        if getattr(request.user, "role", None) not in MANAGERS:
            return Response(
                {"detail": "Only managers and administrators can review forecasts."},
                status=status.HTTP_403_FORBIDDEN,
            )
        if decision not in ("approve", "reject"):
            return Response(
                {"detail": "Decision must be approve or reject."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = ForecastReviewSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            forecast = services.review_forecast(
                forecast_id=pk,
                actor=request.user,
                approve=decision == "approve",
                reason=serializer.validated_data.get("reason", ""),
            )
        except Forecast.DoesNotExist as exc:
            raise Http404 from exc
        except ValidationError as exc:
            return Response({"detail": exc.messages}, status=status.HTTP_400_BAD_REQUEST)
        return Response(ForecastSerializer(forecast).data)
