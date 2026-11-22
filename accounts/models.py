from django.contrib.auth.models import User
from django.db import models

from core.models import Organization


class UserProfile(models.Model):
    """
    Global information about a BuildOps user.

    Organization-specific authorization belongs to
    OrganizationMembership, not this model.
    """

    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name="profile",
    )

    phone = models.CharField(
        max_length=20,
        unique=True,
    )

    # Kept temporarily for backward compatibility with existing data.
    # Do not use this field for authorization.
    role = models.CharField(
        max_length=30,
        blank=True,
        default="",
        help_text=(
            "Legacy role field. Organization-specific roles are "
            "defined by OrganizationMembership."
        ),
    )

    employee_id = models.CharField(
        max_length=30,
        unique=True,
        null=True,
        blank=True,
    )

    department = models.CharField(
        max_length=100,
        blank=True,
    )

    active_organization = models.ForeignKey(
        Organization,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="active_user_profiles",
        help_text=(
            "The organization currently selected by this user. "
            "Must be an organization where the user has an active membership."
        ),
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
    )

    updated_at = models.DateTimeField(
        auto_now=True,
    )

    def __str__(self):
        return self.user.username