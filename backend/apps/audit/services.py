from apps.audit.models import AuditEvent


def log(*, actor, action, resource=None, metadata=None):
    if resource is None:
        resource_type = ""
        resource_id = ""
    else:
        resource_type = resource._meta.label_lower
        resource_id = str(resource.pk)

    return AuditEvent.objects.create(
        actor=actor,
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        metadata={} if metadata is None else metadata,
    )
