from django.contrib.auth import get_user_model
from django.core.mail import send_mail

from apps.orders.models import Order
from common.constants import MANAGERS, Role


def send_order_notification(*, order_id, event_type):
    order = Order.objects.select_related("location").get(pk=order_id)
    if event_type == "order.created":
        roles = MANAGERS | {Role.KITCHEN}
        subject = f"Nouvelle commande {order.number}"
        event = "Une nouvelle commande a été reçue."
    else:
        roles = MANAGERS | {Role.KITCHEN, Role.WAITER}
        subject = f"Mise à jour de la commande {order.number}"
        event = f"Le statut de la commande est maintenant « {order.status} »."

    recipients = list(
        get_user_model()
        .objects.filter(is_active=True, role__in=roles)
        .values_list("email", flat=True)
    )
    if not recipients:
        return 0

    location = (
        f"{order.location.type} {order.location.reference}"
        if order.location_id
        else "Sans emplacement"
    )
    message = (
        f"{event}\n"
        f"Commande : {order.number}\n"
        f"Emplacement : {location}\n"
        f"Total : {order.total} {order.currency}"
    )
    sent = sum(
        send_mail(
            subject,
            message,
            None,
            [recipient],
            fail_silently=False,
        )
        for recipient in recipients
    )
    if sent != len(recipients):
        raise RuntimeError("Le fournisseur email n'a pas confirmé tous les envois.")
    return sent
