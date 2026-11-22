from decimal import Decimal

from django.db.models import Sum
from rest_framework import serializers

from purchases.models import Purchase

from .models import Supplier


class OrganizationAwareSerializerMixin:
    """
    Ensures serializers can validate organization-scoped relationships.
    """

    def get_organization(self):
        request = self.context.get("request")

        if request and request.user and request.user.is_authenticated:
            return getattr(request, "organization", None)

        return None


class SupplierSerializer(
    OrganizationAwareSerializerMixin,
    serializers.ModelSerializer,
):
    class Meta:
        model = Supplier
        fields = "__all__"
        read_only_fields = [
            "id",
            "organization",
            "created_at",
            "updated_at",
        ]

    def validate_name(self, value):
        value = value.strip()

        if not value:
            raise serializers.ValidationError(
                "Supplier name cannot be empty."
            )

        return value

    def validate_phone(self, value):
        value = value.strip()

        if not value:
            raise serializers.ValidationError(
                "Supplier phone number is required."
            )

        return value

    def validate_credit_limit(self, value):
        if value < Decimal("0.00"):
            raise serializers.ValidationError(
                "Credit limit cannot be negative."
            )

        return value


class SupplierPurchaseHistorySerializer(serializers.ModelSerializer):
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
    """
    Summary of a supplier's purchasing relationship.
    """

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


class SupplierPurchaseHistoryResponseSerializer(serializers.Serializer):
    """
    Complete supplier purchase-history response.
    """

    supplier = serializers.IntegerField()
    summary = SupplierPurchaseSummarySerializer()
    purchases = SupplierPurchaseHistorySerializer(
        many=True,
    )