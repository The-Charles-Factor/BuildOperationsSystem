from django.db import models

from core.models import Organization


class Customer(models.Model):
    CUSTOMER_TYPES = [
        ("individual", "Individual"),
        ("business", "Business"),
        ("contractor", "Contractor"),
        ("organization", "Organization"),
    ]

    STATUS_CHOICES = [
        ("active", "Active"),
        ("inactive", "Inactive"),
        ("blocked", "Blocked"),
    ]

    organization = models.ForeignKey(
        Organization,
        on_delete=models.PROTECT,
        related_name="customers",
        null=True,
        blank=True,
    )

    # Identity
    name = models.CharField(max_length=200)

    customer_type = models.CharField(
        max_length=20,
        choices=CUSTOMER_TYPES,
        default="individual",
    )

    company_name = models.CharField(
        max_length=200,
        blank=True,
    )

    # Contact
    phone = models.CharField(max_length=20)

    alternate_phone = models.CharField(
        max_length=20,
        blank=True,
    )

    email = models.EmailField(blank=True)

    # Business identification
    tax_pin = models.CharField(
        max_length=20,
        blank=True,
        null=True,
    )

    # Customer status
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default="active",
    )

    # Credit
    credit_limit = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0,
    )

    # General information
    notes = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]
        constraints = [
            models.UniqueConstraint(
                fields=["organization", "tax_pin"],
                name="unique_customer_tax_pin_per_org",
            ),
        ]
        indexes = [
            models.Index(
                fields=["organization", "status"],
                name="customer_org_status_idx",
            ),
            models.Index(
                fields=["organization", "name"],
                name="customer_org_name_idx",
            ),
        ]

    def __str__(self):
        return self.company_name or self.name


class CustomerAddress(models.Model):
    ADDRESS_TYPES = [
        ("billing", "Billing"),
        ("delivery", "Delivery"),
        ("both", "Billing & Delivery"),
    ]

    customer = models.ForeignKey(
        Customer,
        on_delete=models.CASCADE,
        related_name="addresses",
    )

    address_type = models.CharField(
        max_length=20,
        choices=ADDRESS_TYPES,
        default="both",
    )

    address_line = models.TextField()

    city = models.CharField(
        max_length=100,
        blank=True,
    )

    county = models.CharField(
        max_length=100,
        blank=True,
    )

    country = models.CharField(
        max_length=100,
        default="Kenya",
    )

    is_default = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.customer.name} - {self.address_line}"