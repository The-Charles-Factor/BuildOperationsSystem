from django.contrib.auth.models import User
from django.db import models

from core.models import Organization
from customers.models import Customer
from products.models import Product


class Sale(models.Model):
    STATUS_CHOICES = [
        ("draft", "Draft"),
        ("completed", "Completed"),
        ("cancelled", "Cancelled"),
        ("returned", "Returned"),
    ]

    PAYMENT_STATUS_CHOICES = [
        ("unpaid", "Unpaid"),
        ("partially_paid", "Partially Paid"),
        ("paid", "Paid"),
    ]

    PAYMENT_METHOD_CHOICES = [
        ("cash", "Cash"),
        ("mpesa", "M-Pesa"),
        ("card", "Card"),
        ("bank_transfer", "Bank Transfer"),
        ("credit", "Credit"),
    ]

    organization = models.ForeignKey(
        Organization,
        on_delete=models.PROTECT,
        related_name="sales",
        null=True,
        blank=True,
    )
    sale_number = models.CharField(max_length=50)
    customer = models.ForeignKey(
        Customer,
        on_delete=models.PROTECT,
        related_name="sales",
        null=True,
        blank=True,
    )
    sale_date = models.DateTimeField(auto_now_add=True)

    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default="draft",
    )

    payment_status = models.CharField(
        max_length=20,
        choices=PAYMENT_STATUS_CHOICES,
        default="unpaid",
    )

    payment_method = models.CharField(
        max_length=30,
        choices=PAYMENT_METHOD_CHOICES,
        default="cash",
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
    amount_paid = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0,
    )

    notes = models.TextField(blank=True)

    created_by = models.ForeignKey(
        User,
        on_delete=models.PROTECT,
        related_name="sales_created",
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-sale_date"]
        constraints = [
            models.UniqueConstraint(
                fields=["organization", "sale_number"],
                name="unique_sale_number_per_org",
            ),
        ]
        indexes = [
            models.Index(
                fields=["organization", "status"],
                name="sale_org_status_idx",
            ),
            models.Index(
                fields=["organization", "sale_date"],
                name="sale_org_date_idx",
            ),
            models.Index(
                fields=["organization", "customer"],
                name="sale_org_customer_idx",
            ),
        ]

    def __str__(self):
        return self.sale_number


class SaleItem(models.Model):
    organization = models.ForeignKey(
        Organization,
        on_delete=models.PROTECT,
        related_name="sale_items",
        null=True,
        blank=True,
    )
    sale = models.ForeignKey(
        Sale,
        on_delete=models.CASCADE,
        related_name="items",
    )
    product = models.ForeignKey(
        Product,
        on_delete=models.PROTECT,
        related_name="sale_items",
    )
    quantity = models.DecimalField(
        max_digits=12,
        decimal_places=2,
    )
    unit_price = models.DecimalField(
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
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(
                fields=["organization", "sale"],
                name="saleitem_org_sale_idx",
            ),
            models.Index(
                fields=["organization", "product"],
                name="saleitem_org_product_idx",
            ),
        ]

    def __str__(self):
        return f"{self.sale.sale_number} - {self.product.name}"


class SalePayment(models.Model):
    PAYMENT_METHOD_CHOICES = [
        ("cash", "Cash"),
        ("mpesa", "M-Pesa"),
        ("card", "Card"),
        ("bank_transfer", "Bank Transfer"),
    ]

    organization = models.ForeignKey(
        Organization,
        on_delete=models.PROTECT,
        related_name="sale_payments",
        null=True,
        blank=True,
    )
    sale = models.ForeignKey(
        Sale,
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

    received_by = models.ForeignKey(
        User,
        on_delete=models.PROTECT,
        related_name="sale_payments_received",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(
                fields=["organization", "sale"],
                name="salepay_org_sale_idx",
            ),
            models.Index(
                fields=["organization", "created_at"],
                name="salepay_org_created_idx",
            ),
        ]

    def __str__(self):
        return f"{self.sale.sale_number} - {self.amount}"


class SaleRefund(models.Model):
    REFUND_METHOD_CHOICES = [
        ("cash", "Cash"),
        ("mpesa", "M-Pesa"),
        ("card", "Card"),
        ("bank_transfer", "Bank Transfer"),
    ]

    organization = models.ForeignKey(
        Organization,
        on_delete=models.PROTECT,
        related_name="sale_refunds",
        null=True,
        blank=True,
    )

    refund_number = models.CharField(max_length=50)

    sale = models.ForeignKey(
        Sale,
        on_delete=models.PROTECT,
        related_name="refunds",
    )

    # Nullable for compatibility with any old refund records.
    # New refunds created by BuildOps will always reference a return.
    sale_return = models.OneToOneField(
        "SaleReturn",
        on_delete=models.PROTECT,
        related_name="refund",
        null=True,
        blank=True,
    )

    amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
    )

    refund_method = models.CharField(
        max_length=30,
        choices=REFUND_METHOD_CHOICES,
    )

    reference = models.CharField(
        max_length=100,
        blank=True,
    )

    reason = models.TextField()

    processed_by = models.ForeignKey(
        User,
        on_delete=models.PROTECT,
        related_name="sale_refunds_processed",
    )

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["organization", "refund_number"],
                name="unique_refund_number_per_org",
            ),
        ]
        indexes = [
            models.Index(
                fields=["organization", "sale"],
                name="saleref_org_sale_idx",
            ),
            models.Index(
                fields=["organization", "created_at"],
                name="saleref_org_created_idx",
            ),
        ]

    def __str__(self):
        return self.refund_number


class SaleReturn(models.Model):
    STATUS_CHOICES = [
        ("pending", "Pending"),
        ("completed", "Completed"),
        ("cancelled", "Cancelled"),
    ]

    organization = models.ForeignKey(
        Organization,
        on_delete=models.PROTECT,
        related_name="sale_returns",
        null=True,
        blank=True,
    )

    return_number = models.CharField(max_length=50)

    sale = models.ForeignKey(
        Sale,
        on_delete=models.PROTECT,
        related_name="returns",
    )

    reason = models.TextField()

    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default="pending",
    )

    created_by = models.ForeignKey(
        User,
        on_delete=models.PROTECT,
        related_name="sale_returns_created",
    )

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["organization", "return_number"],
                name="unique_return_number_per_org",
            ),
        ]
        indexes = [
            models.Index(
                fields=["organization", "sale"],
                name="salereturn_org_sale_idx",
            ),
            models.Index(
                fields=["organization", "status"],
                name="salereturn_org_status_idx",
            ),
        ]

    def __str__(self):
        return self.return_number


class SaleReturnItem(models.Model):
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name="sale_return_items",
        null=True,
        blank=True,
    )

    sale_return = models.ForeignKey(
        SaleReturn,
        on_delete=models.CASCADE,
        related_name="items",
    )

    sale_item = models.ForeignKey(
        SaleItem,
        on_delete=models.PROTECT,
        related_name="return_items",
    )

    quantity = models.DecimalField(
        max_digits=12,
        decimal_places=2,
    )

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(
                fields=["organization", "sale_return"],
                name="saleretitem_org_return_idx",
            ),
            models.Index(
                fields=["organization", "sale_item"],
                name="saleretitem_org_item_idx",
            ),
        ]

    def __str__(self):
        return (
            f"{self.sale_return.return_number} - "
            f"{self.sale_item.product.name}"
        )   