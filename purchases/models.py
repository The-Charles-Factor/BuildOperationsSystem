from django.contrib.auth.models import User
from django.db import models
from django.utils import timezone

from core.models import Organization
from suppliers.models import Supplier
from products.models import Product


class Purchase(models.Model):
    STATUS_CHOICES = [
        ("draft", "Draft"),
        ("ordered", "Ordered"),
        ("partially_received", "Partially Received"),
        ("received", "Received"),
        ("cancelled", "Cancelled"),
    ]

    PAYMENT_STATUS_CHOICES = [
        ("unpaid", "Unpaid"),
        ("partially_paid", "Partially Paid"),
        ("paid", "Paid"),
    ]

    organization = models.ForeignKey(
        Organization,
        on_delete=models.PROTECT,
        related_name="purchases",
        null=True,
        blank=True,
    )

    purchase_number = models.CharField(
        max_length=80,
        unique=False,
        blank=True,
        editable=False,
    )

    supplier = models.ForeignKey(
        Supplier,
        on_delete=models.PROTECT,
        related_name="purchases",
    )

    purchase_date = models.DateTimeField()

    expected_delivery_date = models.DateField(
        null=True,
        blank=True,
    )

    status = models.CharField(
        max_length=30,
        choices=STATUS_CHOICES,
        default="draft",
    )

    payment_status = models.CharField(
        max_length=20,
        choices=PAYMENT_STATUS_CHOICES,
        default="unpaid",
    )

    subtotal = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0,
    )

    tax_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0,
    )

    discount_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0,
    )

    total_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0,
    )

    notes = models.TextField(blank=True)

    created_by = models.ForeignKey(
        User,
        on_delete=models.PROTECT,
        related_name="purchases_created",
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-purchase_date"]
        constraints = [
            models.UniqueConstraint(
                fields=["organization", "purchase_number"],
                name="unique_purchase_number_per_org",
            ),
        ]
        indexes = [
            models.Index(
                fields=["organization", "status"],
                name="purchase_org_status_idx",
            ),
            models.Index(
                fields=["organization", "purchase_date"],
                name="purchase_org_date_idx",
            ),
            models.Index(
                fields=["organization", "supplier"],
                name="purchase_org_supplier_idx",
            ),
        ]

    def save(self, *args, **kwargs):
        if not self.purchase_number:
            self.purchase_number = self._generate_purchase_number()
        super().save(*args, **kwargs)

    def _generate_purchase_number(self):
        """
        Generate a human-readable, org-scoped purchase number
        in the form PO-<org_id>-YYYYMMDD-NNNN.

        Falls back to an org-less prefix when organization is
        not yet set (e.g. during data migrations or shell use).
        """
        today = timezone.now().strftime("%Y%m%d")

        if self.organization_id:
            prefix = f"PO-{self.organization_id}-{today}-"
        else:
            prefix = f"PO-{today}-"

        last = (
            Purchase.objects
            .filter(purchase_number__startswith=prefix)
            .order_by("-purchase_number")
            .values_list("purchase_number", flat=True)
            .first()
        )

        seq = int(last.split("-")[-1]) + 1 if last else 1
        return f"{prefix}{seq:04d}"

    def __str__(self):
        return self.purchase_number


class PurchaseItem(models.Model):
    organization = models.ForeignKey(
        Organization,
        on_delete=models.PROTECT,
        related_name="purchase_items",
        null=True,
        blank=True,
    )

    purchase = models.ForeignKey(
        Purchase,
        on_delete=models.CASCADE,
        related_name="items",
    )

    product = models.ForeignKey(
        Product,
        on_delete=models.PROTECT,
        related_name="purchase_items",
    )

    quantity = models.DecimalField(
        max_digits=12,
        decimal_places=2,
    )

    unit_cost = models.DecimalField(
        max_digits=12,
        decimal_places=2,
    )

    tax_rate = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=0,
    )

    discount_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0,
    )

    line_total = models.DecimalField(
        max_digits=12,
        decimal_places=2,
    )

    received_quantity = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0,
    )

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["id"]
        indexes = [
            models.Index(
                fields=["organization", "purchase"],
                name="purchaseitem_org_purchase_idx",
            ),
            models.Index(
                fields=["organization", "product"],
                name="purchaseitem_org_product_idx",
            ),
        ]

    def __str__(self):
        return f"{self.purchase.purchase_number} - {self.product.name}"


class PurchasePayment(models.Model):
    PAYMENT_METHOD_CHOICES = [
        ("cash", "Cash"),
        ("mpesa", "M-Pesa"),
        ("card", "Card"),
        ("bank_transfer", "Bank Transfer"),
    ]

    organization = models.ForeignKey(
        Organization,
        on_delete=models.PROTECT,
        related_name="purchase_payments",
        null=True,
        blank=True,
    )

    purchase = models.ForeignKey(
        Purchase,
        on_delete=models.PROTECT,
        related_name="payments",
    )

    amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
    )

    payment_method = models.CharField(
        max_length=30,
        choices=PAYMENT_METHOD_CHOICES,
    )

    reference = models.CharField(
        max_length=100,
        blank=True,
    )

    notes = models.TextField(blank=True)

    paid_by = models.ForeignKey(
        User,
        on_delete=models.PROTECT,
        related_name="purchase_payments",
    )

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(
                fields=["organization", "purchase"],
                name="purchasepay_org_purchase_idx",
            ),
            models.Index(
                fields=["organization", "created_at"],
                name="purchasepay_org_created_idx",
            ),
        ]

    def __str__(self):
        return f"{self.purchase.purchase_number} - {self.amount}"