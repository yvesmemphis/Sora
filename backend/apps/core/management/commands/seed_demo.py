import os
from datetime import datetime, time, timedelta
from decimal import Decimal

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from apps.analytics.services import forecast_dish
from apps.core.models import RestaurantSettings
from apps.inventory.models import Ingredient, RecipeVersion, Supplier
from apps.inventory.services import publish_recipe_version, receive_lot
from apps.locations.models import Location
from apps.menu.models import Category, Dish
from apps.orders.models import Order, OrderItem, OrderStatusHistory
from apps.orders.services import _next_order_number
from apps.production.models import ProductionBatch
from apps.production.services import declare_waste
from common.constants import LocationType, OrderMode, OrderStatus, Role


class Command(BaseCommand):
    help = "Crée un jeu de données de démonstration reproductible."

    def add_arguments(self, parser):
        parser.add_argument("--force-demo", action="store_true")

    @transaction.atomic
    def handle(self, *args, **options):
        if not settings.DEBUG and not options["force_demo"]:
            raise CommandError("Refusé hors DEBUG sans --force-demo.")
        password = os.environ.get("DEMO_PASSWORD")
        if not password:
            raise CommandError("Définissez DEMO_PASSWORD avant de lancer la commande.")

        users = self._users(password)
        RestaurantSettings.load()
        self._locations()
        dishes = self._menu(users[Role.MANAGER])
        self._inventory(users[Role.MANAGER], dishes)
        self._production(users[Role.MANAGER])
        self._history(users[Role.WAITER], users[Role.MANAGER], dishes[0])
        forecast_dish(timezone.localdate() + timedelta(days=1))
        self.stdout.write(self.style.SUCCESS("Données de démonstration prêtes."))

    def _users(self, password):
        user_model = get_user_model()
        users = {}
        for role in Role:
            email = f"{role.lower()}@example.com"
            user, created = user_model.objects.get_or_create(
                email=email,
                defaults={"role": role, "first_name": role.title()},
            )
            if created or not user.check_password(password):
                user.set_password(password)
                user.save(update_fields=["password"])
            if user.role != role:
                user.role = role
                user.save(update_fields=["role"])
            users[role] = user
        return users

    def _locations(self):
        for number in range(1, 21):
            Location.objects.get_or_create(
                type=LocationType.TABLE, reference=f"T{number}"
            )
        for number in range(201, 206):
            Location.objects.get_or_create(
                type=LocationType.ROOM, reference=str(number)
            )

    def _menu(self, actor):
        names = ["Soupe du jour", "Poulet rôti", "Tarte aux pommes"]
        prices = [Decimal("6.50"), Decimal("18.00"), Decimal("7.00")]
        categories = {}
        for name, position in [("Entrées", 1), ("Plats", 2), ("Desserts", 3)]:
            categories[name], _ = Category.objects.get_or_create(
                name=name,
                defaults={"position": position, "created_by": actor},
            )
        dishes = []
        for name, price, category_name in zip(names, prices, categories, strict=True):
            dish, _ = Dish.objects.get_or_create(
                name=name,
                category=categories[category_name],
                defaults={"price": price, "created_by": actor},
            )
            dishes.append(dish)
        return dishes

    def _inventory(self, actor, dishes):
        supplier, _ = Supplier.objects.get_or_create(
            name="Fournisseur Démo", defaults={"created_by": actor}
        )
        ingredients = []
        for name, cost in [("Légumes", "2.50"), ("Poulet", "8.00"), ("Farine", "1.20")]:
            ingredient, _ = Ingredient.objects.get_or_create(
                name=name,
                defaults={
                    "unit_of_measure": "KG",
                    "minimum_stock": Decimal("2.000"),
                    "supplier": supplier,
                    "cost_per_unit": Decimal(cost),
                    "created_by": actor,
                },
            )
            if not ingredient.stock_lots.exists():
                receive_lot(
                    ingredient=ingredient,
                    quantity=Decimal("100.000"),
                    cost_per_unit=Decimal(cost),
                    date_received=timezone.localdate(),
                    date_expiration=timezone.localdate() + timedelta(days=30),
                    supplier=supplier,
                    actor=actor,
                )
            ingredients.append(ingredient)

        for dish, ingredient in zip(dishes, ingredients, strict=True):
            if not RecipeVersion.objects.filter(
                menu_item_id=str(dish.pk), is_active=True
            ).exists():
                publish_recipe_version(
                    menu_item_id=str(dish.pk),
                    name=f"Recette {dish.name}",
                    items=[
                        {
                            "ingredient": ingredient,
                            "quantity_required": Decimal("0.250"),
                        }
                    ],
                    actor=actor,
                )
        return ingredients

    def _production(self, actor):
        today = timezone.localdate()
        batch, created = ProductionBatch.objects.get_or_create(
            product_name="Poulet rôti",
            production_date=today,
            defaults={
                "quantity_produced": Decimal("12.00"),
                "quantity_remaining": Decimal("12.00"),
                "unit_cost": Decimal("5.00"),
                "created_by": actor,
            },
        )
        if created:
            declare_waste(
                batch_id=batch.pk,
                remaining_quantity=Decimal("1.00"),
                reusable_quantity=Decimal("0.50"),
                discarded_quantity=Decimal("0.50"),
                reason="Démo fin de service",
                actor=actor,
            )

    def _history(self, waiter, manager, dish):
        today = timezone.localdate()
        for week in range(1, 7):
            sold_on = today - timedelta(weeks=week)
            idempotency_key = f"demo-history-{sold_on:%Y%m%d}"
            if Order.objects.filter(idempotency_key=idempotency_key).exists():
                continue
            order = Order.objects.create(
                number=_next_order_number(),
                idempotency_key=idempotency_key,
                status=OrderStatus.COMPLETED,
                mode=OrderMode.TAKEAWAY,
                source="STAFF",
                created_by=waiter,
                subtotal=dish.price,
                total=dish.price,
            )
            OrderItem.objects.create(
                order=order,
                menu_item_id=str(dish.pk),
                menu_item_name=dish.name,
                quantity=1,
                unit_price=dish.price,
                total_price=dish.price,
            )
            historical_time = timezone.make_aware(
                datetime.combine(sold_on, time(hour=12))
            )
            Order.objects.filter(pk=order.pk).update(created_at=historical_time)
            OrderStatusHistory.objects.create(
                order=order,
                from_status="",
                to_status=OrderStatus.COMPLETED,
                changed_by=manager,
                note="Commande historique de démonstration",
            )
