from django.conf import settings
from django.utils.module_loading import import_string


def get_menu_item(menu_item_id):
    """Resolve an active menu item through the configured server-side adapter."""
    service_path = getattr(settings, "ORDER_MENU_PRICING_SERVICE", None)
    if not service_path:
        from apps.menu.models import Dish

        try:
            return Dish.objects.select_related("category").get(
                pk=menu_item_id,
                is_published=True,
                is_available=True,
                category__is_active=True,
            )
        except (Dish.DoesNotExist, ValueError):
            return None

    return import_string(service_path)(menu_item_id)
