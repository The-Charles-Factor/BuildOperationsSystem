from django.contrib.auth.models import User
from django.db import models

from core.models import Organization
from products.models import Product


class InventoryItem(models.Model):
    organization = models.ForeignKey(
        Organization,
        on_delete=models.PROTECT,
        related_name="inventory_items",
        null=True,
        blank=True,
    )

    product = models.OneToOneField(
        Product,
        on_delete=models.PROTECT,
        related_name="inventory",
    )

    quantity = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0,
    )

    reorder_level = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0,
    )

    reorder_quantity = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0,
    )

    location = models.CharField(
        max_length=100,
        default="Main Store",
    )

    is_active = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)

    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["product__name"]
        indexes = [
            models.Index(
                fields=["organization", "is_active"],
                name="inventory_org_active_idx",
            ),
            models.Index(
                fields=["organization", "location"],
                name="inventory_org_location_idx",
            ),
        ]

    def __str__(self):
        return f"{self.product.name} - {self.quantity}"


class StockMovement(models.Model):
    MOVEMENT_TYPES = [
        ("purchase", "Purchase"),
        ("sale", "Sale"),
        ("return_in", "Customer Return"),
        ("return_out", "Supplier Return"),
        ("adjustment", "Adjustment"),
        ("damage", "Damage"),
        ("opening", "Opening Stock"),
        ("transfer_in", "Transfer In"),
        ("transfer_out", "Transfer Out"),
    ]

    organization = models.ForeignKey(
        Organization,
        on_delete=models.PROTECT,
        related_name="stock_movements",
        null=True,
        blank=True,
    )

    inventory_item = models.ForeignKey(
        InventoryItem,
        on_delete=models.PROTECT,
        related_name="movements",
    )

    purchase = models.ForeignKey(
        "purchases.Purchase",
        on_delete=models.PROTECT,
        related_name="stock_movements",
        null=True,
        blank=True,
    )

    sale = models.ForeignKey(
        "sales.Sale",
        on_delete=models.PROTECT,
        related_name="stock_movements",
        null=True,
        blank=True,
    )

    movement_type = models.CharField(
        max_length=20,
        choices=MOVEMENT_TYPES,
    )

    quantity = models.DecimalField(
        max_digits=12,
        decimal_places=2,
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
        related_name="stock_movements",
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
    )

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(
                fields=["organization", "created_at"],
                name="stockmove_org_created_idx",
            ),
            models.Index(
                fields=["organization", "movement_type", "created_at"],
                name="stockmove_org_type_idx",
            ),
        ]

    def __str__(self):
        return (
            f"{self.inventory_item.product.name} - "
            f"{self.movement_type} - {self.quantity}"
        )