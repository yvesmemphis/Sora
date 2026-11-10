from django.conf import settings
from django.utils.module_loading import import_string

from common.exceptions import DomainError


def get_menu_item(menu_item_id):
    """Resolve an active menu item through the configured server-side adapter."""
    service_path = getattr(settings, "ORDER_MENU_PRICING_SERVICE", None)
    if not service_path:
        raise DomainError(
            "menu_pricing_unavailable",
            "Le catalogue de prix serveur n'est pas encore configuré.",
            503,
        )

    return import_string(service_path)(menu_item_id)
