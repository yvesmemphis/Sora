from django.core.management.base import BaseCommand, CommandError

from apps.inventory.services import check_all_stock_alerts


class Command(BaseCommand):
    help = "Met à jour les alertes de seuil et de péremption des stocks."

    def add_arguments(self, parser):
        parser.add_argument("--expiry-days", type=int, default=7)

    def handle(self, *args, **options):
        expiry_days = options["expiry_days"]
        if expiry_days < 0:
            raise CommandError("--expiry-days doit être positif ou nul.")
        alerts = check_all_stock_alerts(expiry_days=expiry_days)
        self.stdout.write(
            self.style.SUCCESS(
                f"Vérification terminée : {len(alerts)} alerte(s) active(s)."
            )
        )
