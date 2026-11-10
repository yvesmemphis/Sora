from datetime import date, timedelta

from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from apps.analytics.services import forecast_dish


class Command(BaseCommand):
    help = "Generate next-day dish forecasts from recent matching weekdays."
    requires_system_checks = ("models",)

    def add_arguments(self, parser):
        parser.add_argument("--target-date", help="Forecast date (YYYY-MM-DD).")
        parser.add_argument(
            "--history-weeks",
            type=int,
            default=8,
            help="Number of prior matching weekdays to inspect (default: 8).",
        )

    def handle(self, *args, **options):
        target_date = options["target_date"]
        if target_date:
            try:
                target_date = date.fromisoformat(target_date)
            except ValueError as exc:
                raise CommandError("--target-date must use YYYY-MM-DD.") from exc
        else:
            target_date = timezone.localdate() + timedelta(days=1)

        try:
            forecasts = forecast_dish(
                target_date, history_weeks=options["history_weeks"]
            )
        except ValueError as exc:
            raise CommandError(str(exc)) from exc
        self.stdout.write(
            self.style.SUCCESS(
                f"Created {len(forecasts)} forecast(s) for {target_date}."
            )
        )
