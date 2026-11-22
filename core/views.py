from rest_framework import permissions, viewsets
from rest_framework.exceptions import PermissionDenied

from .models import AuditLog
from .serializers import AuditLogSerializer
from .tenant import (
    MultipleOrganizationsError,
    NoOrganizationError,
    get_current_organization,
    get_user_membership,
)


class AuditLogViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Read-only, organization-scoped audit history.

    Audit records are never queried using an organization supplied
    by the client. The organization is resolved from the authenticated
    user's active membership.
    """

    serializer_class = AuditLogSerializer

    permission_classes = [
        permissions.IsAuthenticated
    ]

    def get_queryset(self):
        user = self.request.user

        try:
            organization = get_current_organization(user)
        except (
            NoOrganizationError,
            MultipleOrganizationsError,
        ) as exc:
            raise PermissionDenied(str(exc)) from exc

        membership = get_user_membership(
            user,
            organization,
        )

        if membership is None:
            raise PermissionDenied(
                "You do not have an active membership "
                "in the current organization."
            )

        if membership.role not in {
            "owner",
            "admin",
            "manager",
        }:
            raise PermissionDenied(
                "You do not have permission to view "
                "organization audit logs."
            )

        return (
            AuditLog.objects
            .filter(
                organization=organization,
            )
            .select_related(
                "user",
                "organization",
            )
            .order_by("-created_at", "-id")
        )