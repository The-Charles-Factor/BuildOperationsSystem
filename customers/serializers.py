from rest_framework import serializers

from .models import Customer, CustomerAddress

from decimal import Decimal
from rest_framework import serializers
from sales.models import Sale, SaleReturnItem


class CustomerSerializer(serializers.ModelSerializer):
    organization = serializers.PrimaryKeyRelatedField(
        read_only=True
    )

    class Meta:
        model = Customer
        fields = "__all__"
        read_only_fields = [
            "organization",
            "created_at",
            "updated_at",
        ]


class CustomerAddressSerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomerAddress
        fields = "__all__"
        read_only_fields = [
            "created_at",
        ]




class CustomerSaleHistorySerializer(serializers.ModelSerializer):
    refunded_amount = serializers.SerializerMethodField()
    net_total = serializers.SerializerMethodField()
    net_paid = serializers.SerializerMethodField()

    class Meta:
        model = Sale
        fields = [
            "id",
            "sale_number",
            "sale_date",
            "status",
            "payment_status",
            "payment_method",
            "subtotal",
            "tax_amount",
            "discount_amount",
            "total_amount",
            "amount_paid",
            "refunded_amount",
            "net_total",
            "net_paid",
            "notes",
        ]

    def get_refunded_amount(self, obj):
        return sum(
            (
                refund.amount
                for refund in obj.refunds.all()
            ),
            Decimal("0.00"),
        )

    def get_net_total(self, obj):
        refunded = self.get_refunded_amount(obj)
        return obj.total_amount - refunded

    def get_net_paid(self, obj):
        refunded = self.get_refunded_amount(obj)
        return max(
            Decimal("0.00"),
            obj.amount_paid - refunded,
        )



class CustomerPurchaseSummarySerializer(serializers.Serializer):
    total_sales = serializers.IntegerField()
    total_spent = serializers.DecimalField(
        max_digits=12,
        decimal_places=2,
    )
    total_discount = serializers.DecimalField(
        max_digits=12,
        decimal_places=2,
    )
    total_paid = serializers.DecimalField(
        max_digits=12,
        decimal_places=2,
    )
    total_refunded = serializers.DecimalField(
        max_digits=12,
        decimal_places=2,
    )
    net_spent = serializers.DecimalField(
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