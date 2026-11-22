from django.db import models

from core.models import Organization


class Category(models.Model):
    organization = models.ForeignKey(
        Organization,
        on_delete=models.PROTECT,
        related_name="categories",
        null=True,
        blank=True,
    )

    name = models.CharField(
        max_length=100,
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
        verbose_name_plural = "Categories"
        ordering = ["name"]
        constraints = [
            models.UniqueConstraint(
                fields=["organization", "name"],
                name="unique_category_per_organization",
            ),
        ]

    def __str__(self):
        return self.name


class Brand(models.Model):
    organization = models.ForeignKey(
        Organization,
        on_delete=models.PROTECT,
        related_name="brands",
        null=True,
        blank=True,
    )

    name = models.CharField(
        max_length=100,
    )

    description = models.TextField(
        blank=True,
    )

    website = models.URLField(
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
        constraints = [
            models.UniqueConstraint(
                fields=["organization", "name"],
                name="unique_brand_per_organization",
            ),
        ]

    def __str__(self):
        return self.name


class Product(models.Model):
    UNIT_CHOICES = [
        ("piece", "Piece"),
        ("box", "Box"),
        ("set", "Set"),
        ("pair", "Pair"),
        ("meter", "Meter"),
        ("kg", "Kilogram"),
        ("liter", "Liter"),
        ("roll", "Roll"),
        ("pack", "Pack"),
        ("bag", "Bag")
    ]

    organization = models.ForeignKey(
        Organization,
        on_delete=models.PROTECT,
        related_name="products",
        null=True,
        blank=True,
    )

    # Identification
    sku = models.CharField(
        max_length=50,
    )

    name = models.CharField(
        max_length=200,
    )

    description = models.TextField(
        blank=True,
    )

    # Classification
    category = models.ForeignKey(
        Category,
        on_delete=models.PROTECT,
        related_name="products",
    )

    brand = models.ForeignKey(
        Brand,
        on_delete=models.PROTECT,
        related_name="products",
        null=True,
        blank=True,
    )

    # Pricing
    cost_price = models.DecimalField(
        max_digits=12,
        decimal_places=2,
    )

    selling_price = models.DecimalField(
        max_digits=12,
        decimal_places=2,
    )

    # Measurement
    unit = models.CharField(
        max_length=20,
        choices=UNIT_CHOICES,
        default="piece",
    )

    # Tax
    tax_rate = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=0,
    )

    # Status
    is_active = models.BooleanField(
        default=True,
    )

    # Audit
    created_at = models.DateTimeField(
        auto_now_add=True,
    )

    updated_at = models.DateTimeField(
        auto_now=True,
    )

    class Meta:
        ordering = ["name"]
        constraints = [
            models.UniqueConstraint(
                fields=["organization", "sku"],
                name="unique_product_sku_per_organization",
            ),
        ]

    def __str__(self):
        return f"{self.name} ({self.sku})"