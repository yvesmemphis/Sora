from apps.audit.models import AuditEvent

FORBIDDEN_KEYS = {
    "password",
    "token",
    "refresh",
    "access",
    "card",
    "pan",
    "cvv",
    "secret",
}


def log(*, actor, action, resource=None, result="SUCCESS", metadata=None):
    if resource is None:
        resource_type = ""
        resource_id = ""
    else:
        resource_type = resource._meta.label_lower
        resource_id = str(resource.pk)

    safe_metadata = {
        key: value
        for key, value in (metadata or {}).items()
        if not any(forbidden in key.lower() for forbidden in FORBIDDEN_KEYS)
    }
    return AuditEvent.objects.create(
        actor=actor if getattr(actor, "pk", None) else None,
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        result=result,
        metadata=safe_metadata,
    )
