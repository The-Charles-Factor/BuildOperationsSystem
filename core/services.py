from django.contrib.auth.models import User

from .models import AuditLog, Organization


def create_audit_log(
    *,
    user: User,
    organization: Organization,
    action: str,
    model_name: str,
    object_id,
    description: str,
):
    """
    Create an organization-scoped audit log entry.

    Every audit record must belong to an organization.
    Organization is supplied by the trusted business service,
    never by the client or AI layer.
    """

    return AuditLog.objects.create(
        organization=organization,
        user=user,
        action=action,
        model_name=model_name,
        object_id=str(object_id),
        description=description,
    )