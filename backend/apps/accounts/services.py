from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.tokens import default_token_generator
from django.core.mail import send_mail
from django.db import transaction
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode

from apps.audit import services as audit
from common.constants import Role
from common.exceptions import DomainError

User = get_user_model()


def send_password_email(user, invited, *, fail_silently=True):
    uid = urlsafe_base64_encode(force_bytes(user.pk))
    token = default_token_generator.make_token(user)
    link = f"{settings.FRONTEND_URL}/reset-password?uid={uid}&token={token}"
    subject = (
        "Votre accès au restaurant"
        if invited
        else "Réinitialisation de votre mot de passe"
    )
    send_mail(
        subject,
        f"Cliquez pour définir votre mot de passe (valable 1 heure) : {link}",
        None,
        [user.email],
        fail_silently=fail_silently,
    )


@transaction.atomic
def invite_staff(*, actor, email, role, first_name="", last_name=""):
    if User.objects.filter(email__iexact=email).exists():
        raise DomainError(
            "email_taken", "Un compte existe déjà avec cet email.", 409
        )
    user = User.objects.create_user(
        email=email,
        role=role,
        first_name=first_name,
        last_name=last_name,
    )
    audit.log(
        actor=actor,
        action="staff.invite",
        resource=user,
        metadata={"role": role},
    )
    transaction.on_commit(lambda: send_password_email(user, invited=True))
    return user


@transaction.atomic
def resend_staff_invitation(*, target, actor):
    try:
        target = User.objects.select_for_update().get(pk=target.pk)
    except User.DoesNotExist:
        raise DomainError("staff_not_found", "Employé introuvable.", 404) from None
    if not target.is_active:
        raise DomainError(
            "staff_inactive", "Impossible d'inviter un compte désactivé.", 409
        )
    if target.has_usable_password():
        raise DomainError(
            "invitation_not_pending",
            "Cet employé a déjà défini son mot de passe.",
            409,
        )
    audit.log(
        actor=actor,
        action="staff.invitation_resent",
        resource=target,
        metadata={"role": target.role},
    )
    transaction.on_commit(
        lambda: send_password_email(target, invited=True, fail_silently=False)
    )
    return target


@transaction.atomic
def change_staff(*, target, actor, role=None, is_active=None):
    if target.pk == actor.pk:
        raise DomainError(
            "self_change", "Vous ne pouvez pas modifier votre propre accès.", 403
        )

    admins = list(
        User.objects.select_for_update().filter(role=Role.ADMIN, is_active=True)
    )
    removes_admin = target.role == Role.ADMIN and (
        (role and role != Role.ADMIN) or is_active is False
    )
    if removes_admin and len(admins) <= 1:
        raise DomainError("last_admin", "Il doit rester un administrateur.", 409)

    before = (target.role, target.is_active)
    if role:
        target.role = role
    if is_active is not None:
        target.is_active = is_active
    target.save(update_fields=["role", "is_active"])
    audit.log(
        actor=actor,
        action="staff.change",
        resource=target,
        metadata={
            "from": list(before),
            "to": [target.role, target.is_active],
        },
    )
    return target
