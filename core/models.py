from django.contrib.auth.models import User
from django.db import models


class Organization(models.Model):
    """
    Represents a BuildOps business/tenant.

    Each organization owns its own business data.
    """

    name = models.CharField(
        max_length=200,
        unique=True,
    )

    slug = models.SlugField(
        max_length=100,
        unique=True,
    )

    business_type = models.CharField(
        max_length=100,
        blank=True,
    )

    phone = models.CharField(
        max_length=30,
        blank=True,
    )

    email = models.EmailField(
        blank=True,
    )

    address = models.TextField(
        blank=True,
    )

    city = models.CharField(
        max_length=100,
        blank=True,
    )

    country = models.CharField(
        max_length=100,
        default="Kenya",
    )

    currency = models.CharField(
        max_length=10,
        default="KES",
    )

    timezone = models.CharField(
        max_length=50,
        default="Africa/Nairobi",
    )

    is_active = models.BooleanField(
        default=True,
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
    )

    updated_at = models.DateTimeField(
        auto_now=True,
    )

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


class OrganizationMembership(models.Model):
    """
    Connects a user to a BuildOps organization.

    A user may belong to multiple organizations and can have
    a different role in each organization.
    """

    ROLE_CHOICES = [
        ("owner", "Owner"),
        ("admin", "Admin"),
        ("manager", "Manager"),
        ("sales", "Sales"),
        ("inventory", "Inventory"),
    ]

    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name="memberships",
    )

    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="organization_memberships",
    )

    role = models.CharField(
        max_length=20,
        choices=ROLE_CHOICES,
        default="sales",
    )

    is_active = models.BooleanField(
        default=True,
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
    )

    updated_at = models.DateTimeField(
        auto_now=True,
    )

    class Meta:
        ordering = ["organization", "user"]
        constraints = [
            models.UniqueConstraint(
                fields=["organization", "user"],
                name="unique_organization_membership",
            ),
        ]
        indexes = [
            models.Index(
                fields=["user", "is_active"],
            ),
            models.Index(
                fields=["organization", "is_active"],
            ),
        ]

    def __str__(self):
        return (
            f"{self.user.username} - "
            f"{self.organization.name} - "
            f"{self.role}"
        )


class AuditLog(models.Model):
    """
    Immutable record of important BuildOps business actions.

    Audit logs are tenant-aware so one organization cannot
    expose another organization's activity.
    """

    ACTION_CHOICES = [
        ("create", "Create"),
        ("update", "Update"),
        ("delete", "Delete"),
        ("approve", "Approve"),
        ("order", "Order"),
        ("receive", "Receive"),
        ("pay", "Pay"),
        ("cancel", "Cancel"),
        ("complete", "Complete"),
        ("adjust", "Adjust"),
    ]

    organization = models.ForeignKey(
        Organization,
        on_delete=models.PROTECT,
        related_name="audit_logs",
        null=True,
        blank=True,
    )

    user = models.ForeignKey(
        User,
        on_delete=models.PROTECT,
        related_name="audit_logs",
    )

    action = models.CharField(
        max_length=20,
        choices=ACTION_CHOICES,
    )

    model_name = models.CharField(
        max_length=100,
    )

    object_id = models.CharField(
        max_length=100,
    )

    description = models.TextField()

    created_at = models.DateTimeField(
        auto_now_add=True,
    )

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(
                fields=["organization", "created_at"],
            ),
            models.Index(
                fields=["organization", "model_name", "object_id"],
            ),
            models.Index(
                fields=["user", "created_at"],
            ),
            models.Index(
                fields=["action", "created_at"],
            ),
        ]

    def __str__(self):
        return (
            f"{self.user.username} - "
            f"{self.action} - "
            f"{self.model_name}"
        )