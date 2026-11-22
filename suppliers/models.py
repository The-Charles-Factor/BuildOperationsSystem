from django.db import models

from core.models import Organization


class Supplier(models.Model):
    PAYMENT_TERMS = [
        ("cash", "Cash"),
        ("credit_7", "7 Days"),
        ("credit_14", "14 Days"),
        ("credit_30", "30 Days"),
        ("credit_60", "60 Days"),
    ]

    STATUS_CHOICES = [
        ("active", "Active"),
        ("inactive", "Inactive"),
        ("blacklisted", "Blacklisted"),
    ]

    organization = models.ForeignKey(
        Organization,
        on_delete=models.PROTECT,
        related_name="suppliers",
        null=True,
        blank=True,
    )

    # Business identity
    name = models.CharField(max_length=150)

    company_name = models.CharField(
        max_length=200,
        blank=True,
    )

    registration_number = models.CharField(
        max_length=100,
        blank=True,
        null=True,
    )

    # Contact
    phone = models.CharField(max_length=20)

    alternate_phone = models.CharField(
        max_length=20,
        blank=True,
    )

    email = models.EmailField(blank=True)

    # Address
    address = models.TextField(blank=True)

    city = models.CharField(
        max_length=100,
        blank=True,
    )

    country = models.CharField(
        max_length=100,
        default="Kenya",
    )

    # Tax / business information
    tax_pin = models.CharField(
        max_length=20,
        blank=True,
        null=True,
    )

    # Commercial terms
    payment_terms = models.CharField(
        max_length=20,
        choices=PAYMENT_TERMS,
        default="cash",
    )

    credit_limit = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0,
    )

    # Operational status
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default="active",
    )

    notes = models.TextField(blank=True)

    # Audit timestamps
    created_at = models.DateTimeField(auto_now_add=True)

    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]
        constraints = [
            models.UniqueConstraint(
                fields=["organization", "registration_number"],
                name="unique_supplier_registration_per_org",
            ),
            models.UniqueConstraint(
                fields=["organization", "tax_pin"],
                name="unique_supplier_tax_pin_per_org",
            ),
        ]
        indexes = [
            models.Index(
                fields=["organization", "status"],
                name="supplier_org_status_idx",
            ),
            models.Index(
                fields=["organization", "name"],
                name="supplier_org_name_idx",
            ),
        ]

    def __str__(self):
        return self.company_name or self.name