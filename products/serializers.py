from decimal import Decimal

from rest_framework import serializers

from .models import Brand, Category, Product


class CategorySerializer(serializers.ModelSerializer):

    class Meta:
        model = Category
        fields = "__all__"

    def validate_name(self, value):
        value = value.strip()

        if not value:
            raise serializers.ValidationError(
                "Category name cannot be blank."
            )

        return value


class BrandSerializer(serializers.ModelSerializer):

    class Meta:
        model = Brand
        fields = "__all__"

    def validate_name(self, value):
        value = value.strip()

        if not value:
            raise serializers.ValidationError(
                "Brand name cannot be blank."
            )

        return value


class ProductSerializer(serializers.ModelSerializer):

    category_id = serializers.PrimaryKeyRelatedField(
        source="category",
        queryset=Category.objects.all(),
    )

    brand_id = serializers.PrimaryKeyRelatedField(
        source="brand",
        queryset=Brand.objects.all(),
        required=False,
        allow_null=True,
    )

    category_name = serializers.CharField(
        source="category.name",
        read_only=True,
    )

    brand_name = serializers.CharField(
        source="brand.name",
        read_only=True,
    )

    class Meta:
        model = Product

        fields = [
            "id",
            "sku",
            "name",
            "description",
            "category_id",
            "category_name",
            "brand_id",
            "brand_name",
            "cost_price",
            "selling_price",
            "unit",
            "tax_rate",
            "is_active",
            "created_at",
            "updated_at",
        ]

        read_only_fields = [
            "id",
            "category_name",
            "brand_name",
            "created_at",
            "updated_at",
        ]

    def validate_sku(self, value):
        value = value.strip()

        if not value:
            raise serializers.ValidationError(
                "SKU cannot be blank."
            )

        return value

    def validate_name(self, value):
        value = value.strip()

        if not value:
            raise serializers.ValidationError(
                "Product name cannot be blank."
            )

        return value

    def validate_cost_price(self, value):
        if value < Decimal("0.00"):
            raise serializers.ValidationError(
                "Cost price cannot be negative."
            )

        return value

    def validate_selling_price(self, value):
        if value < Decimal("0.00"):
            raise serializers.ValidationError(
                "Selling price cannot be negative."
            )

        return value

    def validate_tax_rate(self, value):
        if value < Decimal("0.00") or value > Decimal("100.00"):
            raise serializers.ValidationError(
                "Tax rate must be between 0 and 100."
            )

        return value

    def validate(self, attrs):
        cost_price = attrs.get(
            "cost_price",
            getattr(
                self.instance,
                "cost_price",
                Decimal("0.00"),
            ),
        )

        selling_price = attrs.get(
            "selling_price",
            getattr(
                self.instance,
                "selling_price",
                Decimal("0.00"),
            ),
        )

        if cost_price < Decimal("0.00"):
            raise serializers.ValidationError({
                "cost_price": "Cost price cannot be negative."
            })

        if selling_price < Decimal("0.00"):
            raise serializers.ValidationError({
                "selling_price": "Selling price cannot be negative."
            })

        return attrs