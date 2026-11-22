from django.contrib.auth.models import User

from .models import Organization, OrganizationMembership


class TenantError(Exception):
    """Base exception for tenant-related errors."""


class NoOrganizationError(TenantError):
    """Raised when a user has no active organization."""


class MultipleOrganizationsError(TenantError):
    """
    Raised when a user belongs to multiple organizations but
    no specific organization has been selected.
    """


def get_user_organizations(user: User):
    """
    Return all active organizations accessible to the user.
    """

    if not user or not user.is_authenticated:
        return Organization.objects.none()

    return Organization.objects.filter(
        memberships__user=user,
        memberships__is_active=True,
        is_active=True,
    ).distinct()


def get_user_membership(
    user: User,
    organization: Organization,
):
    """
    Return the user's active membership in an organization.
    """

    return (
        OrganizationMembership.objects.filter(
            user=user,
            organization=organization,
            is_active=True,
            organization__is_active=True,
        )
        .select_related(
            "organization",
            "user",
        )
        .first()
    )


def get_current_organization(user: User):
    """
    Resolve the organization for the authenticated user.

    Rules:
    - Unauthenticated users cannot have a tenant.
    - No active organizations raises NoOrganizationError.
    - One active organization is selected automatically.
    - Multiple organizations require an explicit active selection.
    - A selected organization must belong to the user.
    """

    if not user or not user.is_authenticated:
        raise NoOrganizationError(
            "An authenticated user is required."
        )

    organizations = list(
        get_user_organizations(user)
    )

    if not organizations:
        raise NoOrganizationError(
            "The user does not belong to an active organization."
        )

    # One organization: automatic selection.
    if len(organizations) == 1:
        return organizations[0]

    # Multiple organizations: use the explicitly selected organization.
    try:
        profile = user.profile
    except AttributeError:
        profile = None

    if profile and profile.active_organization_id:
        selected = next(
            (
                organization
                for organization in organizations
                if organization.id == profile.active_organization_id
            ),
            None,
        )

        if selected is not None:
            return selected

    raise MultipleOrganizationsError(
        "The user belongs to multiple organizations. "
        "An organization must be selected."
    )