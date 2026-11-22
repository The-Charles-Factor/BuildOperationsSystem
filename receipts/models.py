from django.contrib.auth.models import User
from django.db import models
from core.models import Organization  # Or your active organization model path


class Receipt(models.Model):
    """
    Stores permanent digital receipt records for completed BuildOps sales transactions.
    Tracks whether physical thermal printing was executed or skipped.
    """

    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name="receipt_records",
    )

    # Links directly to your sales transaction model in the sales app
    transaction = models.OneToOneField(
        "sales.Sale",
        on_delete=models.CASCADE,
        related_name="sale_receipt",
    )

    receipt_number = models.CharField(
        max_length=50,
        unique=True,
        editable=False,
    )

    # Status tracking for physical thermal printing
    is_printed = models.BooleanField(
        default=False,
        help_text="Designates whether a physical thermal receipt was printed.",
    )

    print_attempts = models.PositiveIntegerField(
        default=0,
        help_text="Tracks total print or reprint requests made for this receipt.",
    )

    last_printed_at = models.DateTimeField(
        null=True,
        blank=True,
    )

    printed_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="user_printed_receipts",
    )

    # Immutable snapshot payload containing items, store info, totals, and AI insights
    receipt_payload = models.JSONField(
        help_text="Frozen snapshot of transaction data and AI recommendations at time of payment."
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
    )

    updated_at = models.DateTimeField(
        auto_now=True,
    )


    is_revoked = models.BooleanField(
        default=False,
        help_text="True when the underlying sale is returned or cancelled.",
    )
    revoked_at = models.DateTimeField(
        null=True,
        blank=True,
    )
    revoked_reason = models.CharField(
        max_length=255,
        blank=True,
    )

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["organization", "created_at"]),
            models.Index(fields=["organization", "is_printed"]),
            models.Index(fields=["receipt_number"]),
        ]

    def __str__(self):
        status = "Printed" if self.is_printed else "Not Printed"
        return f"Receipt {self.receipt_number} ({status})"