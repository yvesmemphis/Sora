from django.core.management.base import BaseCommand

from apps.orders.services import confirm_expired_public_orders


class Command(BaseCommand):
    help = "Confirme les commandes publiques dont le délai de désistement est écoulé."

    def handle(self, *args, **options):
        count = confirm_expired_public_orders()
        self.stdout.write(
            self.style.SUCCESS(f"{count} commande(s) confirmée(s) automatiquement.")
        )
