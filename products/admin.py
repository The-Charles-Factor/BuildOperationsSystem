from django.contrib import admin

from .models import Brand, Category, Product


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):

    list_display = [
        "name",
        "is_active",
        "created_at",
        "updated_at",
    ]

    list_filter = [
        "is_active",
    ]

    search_fields = [
        "name",
        "description",
    ]

    ordering = [
        "name",
    ]


@admin.register(Brand)
class BrandAdmin(admin.ModelAdmin):

    list_display = [
        "name",
        "website",
        "is_active",
        "created_at",
        "updated_at",
    ]

    list_filter = [
        "is_active",
    ]

    search_fields = [
        "name",
        "description",
        "website",
    ]

    ordering = [
        "name",
    ]


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):

    list_display = [
        "sku",
        "name",
        "category",
        "brand",
        "cost_price",
        "selling_price",
        "unit",
        "tax_rate",
        "is_active",
    ]

    list_filter = [
        "is_active",
        "category",
        "brand",
        "unit",
    ]

    search_fields = [
        "sku",
        "name",
        "description",
    ]

    ordering = [
        "name",
    ]

    list_select_related = [
        "category",
        "brand",
    ]

    readonly_fields = [
        "created_at",
        "updated_at",
    ]
