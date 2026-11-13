from django.core.management.base import BaseCommand, CommandError
from django.db import models, transaction

from apps.core.models import DemoDataRecord
from common.models import AppendOnlyModel


@transaction.atomic
def purge_demo_data():
    pending = list(DemoDataRecord.objects.select_related("content_type"))
    deleted = 0
    progress = True
    while pending and progress:
        progress = False
        for record in pending[:]:
            instance = record.content_object
            if instance is None:
                record.delete()
                pending.remove(record)
                progress = True
                continue
            if isinstance(instance, AppendOnlyModel):
                continue

            has_dependents = False
            for relation in instance._meta.related_objects:
                related_manager = getattr(instance, relation.get_accessor_name(), None)
                if related_manager is None:
                    continue
                on_delete = getattr(
                    getattr(getattr(relation, "field", None), "remote_field", None),
                    "on_delete",
                    None,
                )
                if (
                    related_manager.exists()
                    and not relation.many_to_many
                    and on_delete is not models.SET_NULL
                ):
                    has_dependents = True
                    break
            if has_dependents:
                continue

            instance.delete()
            record.delete()
            pending.remove(record)
            deleted += 1
            progress = True

    return deleted, len(pending)


class Command(BaseCommand):
    help = "Supprime uniquement les objets explicitement marqués par seed_demo."

    def add_arguments(self, parser):
        parser.add_argument(
            "--confirm",
            action="store_true",
            help="Confirme la suppression des données de démonstration suivies.",
        )

    def handle(self, *args, **options):
        if not options["confirm"]:
            raise CommandError("Ajoutez --confirm pour exécuter la purge.")
        deleted, blocked = purge_demo_data()
        self.stdout.write(
            self.style.SUCCESS(
                f"{deleted} objet(s) de démonstration supprimé(s); "
                f"{blocked} objet(s) conservé(s) en raison de références ou "
                "de règles de conservation append-only."
            )
        )
