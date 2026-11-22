from decimal import Decimal

from django.db import transaction
from rest_framework import serializers

from core.tenant import (
    MultipleOrganizationsError,
    NoOrganizationError,
    get_current_organization,
)

from .models import Purchase, PurchaseItem, PurchasePayment
from django.db.models import Sum


class OrganizationAwareSerializerMixin:
    def get_current_organization(self):
        request = self.context.get("request")

        if not request or not request.user.is_authenticated:
            raise serializers.ValidationError(
                "An authenticated user is required."
            )

        try:
            return get_current_organization(request.user)

        except NoOrganizationError as exc:
            raise serializers.ValidationError(str(exc))

        except MultipleOrganizationsError as exc:
            raise serializers.ValidationError(str(exc))

    def validate_organization_object(self, obj, field_name):
        organization = self.get_current_organization()

        if obj.organization_id != organization.id:
            raise serializers.ValidationError(
                {
                    field_name: (
                        "You cannot use a record from another "
                        "organization."
                    )
                }
            )

        return obj


class PurchaseItemSerializer(
    OrganizationAwareSerializerMixin,
    serializers.ModelSerializer,
):
    class Meta:
        model = PurchaseItem

        fields = [
            "id",
            "product",
            "quantity",
            "unit_cost",
            "tax_rate",
            "discount_amount",
            "line_total",
            "received_quantity",
            "created_at",
        ]

        read_only_fields = [
            "id",
            "line_total",
            "received_quantity",
            "created_at",
        ]

    def validate_product(self, value):
        return self.validate_organization_object(
            value,
            "product",
        )

    def validate_quantity(self, value):
        if value <= Decimal("0.00"):
            raise serializers.ValidationError(
                "Quantity must be greater than zero."
            )

        return value

    def validate_unit_cost(self, value):
        if value < Decimal("0.00"):
            raise serializers.ValidationError(
                "Unit cost cannot be negative."
            )

        return value

    def validate_tax_rate(self, value):
        if value < Decimal("0.00") or value > Decimal("100.00"):
            raise serializers.ValidationError(
                "Tax rate must be between 0 and 100."
            )

        return value

    def validate_discount_amount(self, value):
        if value < Decimal("0.00"):
            raise serializers.ValidationError(
                "Discount cannot be negative."
            )

        return value

    def validate(self, attrs):
        quantity = attrs.get(
            "quantity",
            getattr(
                self.instance,
                "quantity",
                Decimal("0.00"),
            ),
        )

        unit_cost = attrs.get(
            "unit_cost",
            getattr(
                self.instance,
                "unit_cost",
                Decimal("0.00"),
            ),
        )

        discount_amount = attrs.get(
            "discount_amount",
            getattr(
                self.instance,
                "discount_amount",
                Decimal("0.00"),
            ),
        )

        gross_amount = quantity * unit_cost

        if discount_amount > gross_amount:
            raise serializers.ValidationError(
                {
                    "discount_amount": (
                        "Discount cannot exceed the gross "
                        "item amount."
                    )
                }
            )

        return attrs


class PurchasePaymentSerializer(
    OrganizationAwareSerializerMixin,
    serializers.ModelSerializer,
):
    class Meta:
        model = PurchasePayment

        fields = [
            "id",
            "purchase",
            "amount",
            "payment_method",
            "reference",
            "notes",
            "paid_by",
            "created_at",
        ]

        read_only_fields = [
            "id",
            "purchase",
            "paid_by",
            "created_at",
        ]

    def validate_amount(self, value):
        if value <= Decimal("0.00"):
            raise serializers.ValidationError(
                "Payment amount must be greater than zero."
            )

        return value


class PurchaseSerializer(
    OrganizationAwareSerializerMixin,
    serializers.ModelSerializer,
):
    items = PurchaseItemSerializer(many=True)

    payments = PurchasePaymentSerializer(
        many=True,
        read_only=True,
    )

    class Meta:
        model = Purchase

        fields = [
            "id",
            "purchase_number",
            "supplier",
            "purchase_date",
            "expected_delivery_date",
            "status",
            "payment_status",
            "subtotal",
            "tax_amount",
            "discount_amount",
            "total_amount",
            "notes",
            "created_by",
            "created_at",
            "updated_at",
            "items",
            "payments",
        ]

        read_only_fields = [
            "id",
            "purchase_number",
            "status",
            "payment_status",
            "subtotal",
            "tax_amount",
            "discount_amount",
            "total_amount",
            "created_by",
            "created_at",
            "updated_at",
            "payments",
        ]

    def validate_supplier(self, value):
        return self.validate_organization_object(
            value,
            "supplier",
        )

    def validate_items(self, value):
        if not value:
            raise serializers.ValidationError(
                "A purchase must contain at least one item."
            )

        return value

    def validate(self, attrs):
        items = attrs.get("items")

        if items is not None:
            organization = self.get_current_organization()

            for item in items:
                product = item["product"]

                if product.organization_id != organization.id:
                    raise serializers.ValidationError(
                        {
                            "items": (
                                "Every product must belong to "
                                "the current organization."
                            )
                        }
                    )

        return attrs

    @transaction.atomic
    def create(self, validated_data):
        # ---------------------------------------------------------
        # Values passed through serializer.save() by the view
        # are removed from validated_data before creation.
        # ---------------------------------------------------------
        items_data = validated_data.pop("items")

        organization = validated_data.pop(
            "organization",
            self.get_current_organization(),
        )

        created_by = validated_data.pop(
            "created_by",
            self.context["request"].user,
        )

        # ---------------------------------------------------------
        # Tenant validation
        # ---------------------------------------------------------
        supplier = validated_data["supplier"]

        if supplier.organization_id != organization.id:
            raise serializers.ValidationError(
                {
                    "supplier": (
                        "You cannot create a purchase using "
                        "a supplier from another organization."
                    )
                }
            )

        # ---------------------------------------------------------
        # Calculate purchase totals
        # ---------------------------------------------------------
        subtotal = Decimal("0.00")
        tax_amount = Decimal("0.00")
        discount_amount = Decimal("0.00")

        calculated_items = []

        for item_data in items_data:
            quantity = item_data["quantity"]
            unit_cost = item_data["unit_cost"]

            tax_rate = item_data.get(
                "tax_rate",
                Decimal("0.00"),
            )

            discount = item_data.get(
                "discount_amount",
                Decimal("0.00"),
            )

            gross_amount = quantity * unit_cost

            taxable_amount = gross_amount - discount

            item_tax = (
                taxable_amount
                * tax_rate
                / Decimal("100")
            )

            line_total = taxable_amount + item_tax

            subtotal += gross_amount
            discount_amount += discount
            tax_amount += item_tax

            item_data["line_total"] = line_total

            calculated_items.append(item_data)

        total_amount = (
            subtotal
            - discount_amount
            + tax_amount
        )

        # ---------------------------------------------------------
        # Create purchase
        # ---------------------------------------------------------
        purchase = Purchase.objects.create(
            organization=organization,
            created_by=created_by,
            subtotal=subtotal,
            tax_amount=tax_amount,
            discount_amount=discount_amount,
            total_amount=total_amount,
            **validated_data,
        )

        # ---------------------------------------------------------
        # Create purchase items
        # ---------------------------------------------------------
        for item_data in calculated_items:
            PurchaseItem.objects.create(
                organization=organization,
                purchase=purchase,
                **item_data,
            )

        return purchase



class SupplierPurchaseHistorySerializer(serializers.ModelSerializer):
    """
    Represents an individual purchase made from a supplier,
    including the actual amount paid from its payment records.
    """

    paid = serializers.SerializerMethodField()
    outstanding = serializers.SerializerMethodField()

    class Meta:
        model = Purchase
        fields = [
            "id",
            "purchase_number",
            "purchase_date",
            "expected_delivery_date",
            "status",
            "payment_status",
            "subtotal",
            "tax_amount",
            "discount_amount",
            "total_amount",
            "paid",
            "outstanding",
            "notes",
            "created_at",
        ]

    def get_paid(self, obj):
        return sum(
            (
                payment.amount
                for payment in obj.payments.all()
            ),
            Decimal("0.00"),
        )

    def get_outstanding(self, obj):
        paid = self.get_paid(obj)

        return max(
            Decimal("0.00"),
            obj.total_amount - paid,
        )


class SupplierPurchaseSummarySerializer(serializers.Serializer):
    total_purchases = serializers.IntegerField()
    total_purchase_value = serializers.DecimalField(
        max_digits=12,
        decimal_places=2,
    )
    total_paid = serializers.DecimalField(
        max_digits=12,
        decimal_places=2,
    )
    outstanding = serializers.DecimalField(
        max_digits=12,
        decimal_places=2,
    )
    last_purchase_date = serializers.DateTimeField(
        allow_null=True,
    )


class PurchaseReceivingItemSerializer(serializers.Serializer):
    purchase_item_id = serializers.IntegerField()

    quantity = serializers.DecimalField(
        max_digits=12,
        decimal_places=2,
    )

    def validate_quantity(self, value):
        if value <= Decimal("0.00"):
            raise serializers.ValidationError(
                "Received quantity must be greater than zero."
            )

        return value


class PurchaseReceivingSerializer(serializers.Serializer):
    items = PurchaseReceivingItemSerializer(
        many=True,
    )

    def validate_items(self, value):
        if not value:
            raise serializers.ValidationError(
                "At least one purchase item must be received."
            )

        return value


