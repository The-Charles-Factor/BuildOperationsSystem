from django.contrib.auth.models import User
from django.db import models

from core.models import Organization


class ExpenseCategory(models.Model):
    organization = models.ForeignKey(
        Organization,
        on_delete=models.PROTECT,
        related_name="expense_categories",
        null=True,
        blank=True,
    )

    name = models.CharField(
        max_length=100,
    )

    # Canonical value used for duplicate detection.
    # Example:
    # "Electricity", " electricity ", and "ELECTRICITY"
    # all normalize to "electricity".
    name_normalized = models.CharField(
        max_length=100,
        editable=False,
    )

    description = models.TextField(
        blank=True,
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

        verbose_name_plural = "Expense Categories"

        constraints = [
            models.UniqueConstraint(
                fields=[
                    "organization",
                    "name_normalized",
                ],
                name="unique_expense_category_normalized_per_org",
            ),
        ]

        indexes = [
            models.Index(
                fields=[
                    "organization",
                    "is_active",
                ],
                name="expensecat_org_active_idx",
            ),
            models.Index(
                fields=[
                    "organization",
                    "name",
                ],
                name="expensecat_org_name_idx",
            ),
            models.Index(
                fields=[
                    "organization",
                    "name_normalized",
                ],
                name="expensecat_org_normalized_idx",
            ),
        ]

    def __str__(self):
        return self.name


class Expense(models.Model):
    STATUS_CHOICES = [
        ("pending", "Pending"),
        ("approved", "Approved"),
        ("paid", "Paid"),
        ("cancelled", "Cancelled"),
    ]

    PAYMENT_METHOD_CHOICES = [
        ("cash", "Cash"),
        ("mpesa", "M-Pesa"),
        ("card", "Card"),
        ("bank_transfer", "Bank Transfer"),
    ]

    organization = models.ForeignKey(
        Organization,
        on_delete=models.PROTECT,
        related_name="expenses",
        null=True,
        blank=True,
    )

    expense_number = models.CharField(
        max_length=50,
    )

    category = models.ForeignKey(
        ExpenseCategory,
        on_delete=models.PROTECT,
        related_name="expenses",
    )

    description = models.CharField(
        max_length=255,
    )

    amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
    )

    expense_date = models.DateTimeField()

    payment_method = models.CharField(
        max_length=30,
        choices=PAYMENT_METHOD_CHOICES,
        null=True,
        blank=True,
    )

    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default="pending",
    )

    paid_to = models.CharField(
        max_length=200,
        blank=True,
    )

    receipt_number = models.CharField(
        max_length=100,
        blank=True,
    )

    reference = models.CharField(
        max_length=100,
        blank=True,
    )

    notes = models.TextField(
        blank=True,
    )

    created_by = models.ForeignKey(
        User,
        on_delete=models.PROTECT,
        related_name="expenses_created",
    )

    approved_by = models.ForeignKey(
        User,
        on_delete=models.PROTECT,
        related_name="expenses_approved",
        null=True,
        blank=True,
    )

    approved_at = models.DateTimeField(
        null=True,
        blank=True,
    )

    paid_at = models.DateTimeField(
        null=True,
        blank=True,
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
    )

    updated_at = models.DateTimeField(
        auto_now=True,
    )

    class Meta:
        ordering = ["-expense_date"]

        constraints = [
            models.UniqueConstraint(
                fields=[
                    "organization",
                    "expense_number",
                ],
                name="unique_expense_number_per_org",
            ),
        ]

        indexes = [
            models.Index(
                fields=[
                    "organization",
                    "status",
                ],
                name="expense_org_status_idx",
            ),
            models.Index(
                fields=[
                    "organization",
                    "expense_date",
                ],
                name="expense_org_date_idx",
            ),
            models.Index(
                fields=[
                    "organization",
                    "category",
                ],
                name="expense_org_category_idx",
            ),
        ]

    def __str__(self):
        return self.expense_number
