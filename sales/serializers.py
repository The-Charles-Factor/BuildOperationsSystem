from decimal import Decimal
from django.db import transaction
from rest_framework import serializers
from uuid import uuid4

from core.tenant import (
    MultipleOrganizationsError,
    NoOrganizationError,
    get_current_organization,
)

from .models import (
    Sale,
    SaleItem,
    SalePayment,
    SaleRefund,
    SaleReturn,
    SaleReturnItem,
)


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
                        "This record belongs to another organization."
                    )
                }
            )

        return obj


class SaleItemSerializer(
    OrganizationAwareSerializerMixin,
    serializers.ModelSerializer,
):
    sale = serializers.PrimaryKeyRelatedField(
        queryset=Sale.objects.all(),
        required=False,
    )

    class Meta:
        model = SaleItem
        fields = [
            "id",
            "sale",
            "product",
            "quantity",
            "unit_price",
            "tax_rate",
            "discount_amount",
            "line_total",
            "created_at",
        ]
        read_only_fields = [
            "id",
            "line_total",
            "created_at",
        ]

    def validate_sale(self, value):
        return self.validate_organization_object(
            value,
            "sale",
        )

    def validate_product(self, value):
        return self.validate_organization_object(
            value,
            "product",
        )

    def validate_quantity(self, value):
        if value <= 0:
            raise serializers.ValidationError(
                "Quantity must be greater than zero."
            )
        return value

    def validate_unit_price(self, value):
        if value < 0:
            raise serializers.ValidationError(
                "Unit price cannot be negative."
            )
        return value

    def validate_tax_rate(self, value):
        if value < 0 or value > 100:
            raise serializers.ValidationError(
                "Tax rate must be between 0 and 100."
            )
        return value

    def validate_discount_amount(self, value):
        if value < 0:
            raise serializers.ValidationError(
                "Discount cannot be negative."
            )
        return value

    def validate(self, attrs):
        quantity = attrs.get("quantity")
        unit_price = attrs.get("unit_price")

        discount = attrs.get(
            "discount_amount",
            Decimal("0.00"),
        )

        if quantity is not None and unit_price is not None:
            gross_amount = quantity * unit_price

            if discount > gross_amount:
                raise serializers.ValidationError(
                    {
                        "discount_amount": (
                            "Discount cannot be greater than "
                            "the gross amount."
                        )
                    }
                )

        sale = attrs.get("sale")

        if sale and sale.status != "draft":
            raise serializers.ValidationError(
                {
                    "sale": (
                        "Sale items can only be added "
                        "to draft sales."
                    )
                }
            )

        return attrs


class SaleSerializer(
    OrganizationAwareSerializerMixin,
    serializers.ModelSerializer,
):
    items = SaleItemSerializer(many=True)

    class Meta:
        model = Sale
        fields = [
            "id",
            "sale_number",
            "customer",
            "sale_date",
            "status",
            "payment_status",
            "payment_method",
            "subtotal",
            "tax_amount",
            "discount_amount",
            "total_amount",
            "amount_paid",
            "notes",
            "created_by",
            "created_at",
            "updated_at",
            "items",
        ]

        read_only_fields = [
            "id",
            "sale_date",
            "status",
            "payment_status",
            "subtotal",
            "tax_amount",
            "discount_amount",
            "total_amount",
            "amount_paid",
            "created_by",
            "created_at",
            "updated_at",
        ]

        extra_kwargs = {
            "sale_number": {
                "required": False,
                "allow_blank": True,
            },
            "customer": {
                "required": False,
                "allow_null": True,
            },
        }

    def validate_customer(self, value):
        if value is None:
            return None

        return self.validate_organization_object(
            value,
            "customer",
        )

    def validate_items(self, value):
        if not value:
            raise serializers.ValidationError(
                "A sale must contain at least one item."
            )

        return value

    def validate_amount_paid(self, value):
        if value < 0:
            raise serializers.ValidationError(
                "Amount paid cannot be negative."
            )

        return value

    def validate(self, attrs):
        organization = self.get_current_organization()

        customer = attrs.get("customer")

        if customer and customer.organization_id != organization.id:
            raise serializers.ValidationError(
                {
                    "customer": (
                        "This customer belongs to another organization."
                    )
                }
            )

        items = attrs.get("items")

        if items:
            for item in items:
                product = item.get("product")

                if (
                    product
                    and product.organization_id != organization.id
                ):
                    raise serializers.ValidationError(
                        {
                            "items": (
                                "All products must belong to "
                                "the current organization."
                            )
                        }
                    )

        return attrs

    def calculate_totals(self, items_data):
        subtotal = Decimal("0.00")
        tax_amount = Decimal("0.00")
        discount_amount = Decimal("0.00")
        calculated_items = []

        for item_data in items_data:
            quantity = item_data["quantity"]
            unit_price = item_data["unit_price"]

            tax_rate = item_data.get(
                "tax_rate",
                Decimal("0.00"),
            )

            discount = item_data.get(
                "discount_amount",
                Decimal("0.00"),
            )

            gross_amount = quantity * unit_price

            if discount > gross_amount:
                raise serializers.ValidationError(
                    {
                        "items": (
                            "Discount cannot be greater than "
                            "the item's gross amount."
                        )
                    }
                )

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

        return (
            subtotal,
            tax_amount,
            discount_amount,
            total_amount,
            calculated_items,
        )

    @transaction.atomic
    def create(self, validated_data):
        items_data = validated_data.pop("items")

        (
            subtotal,
            tax_amount,
            discount_amount,
            total_amount,
            calculated_items,
        ) = self.calculate_totals(items_data)

        request = self.context["request"]

        organization = validated_data.pop("organization")

        created_by = validated_data.pop(
            "created_by",
            request.user,
        )

        sale_number = validated_data.pop(
            "sale_number",
            "",
        ).strip()

        if not sale_number:
            sale_number = (
                f"SAL-{uuid4().hex[:10].upper()}"
            )

        sale = Sale.objects.create(
            created_by=created_by,
            organization=organization,
            sale_number=sale_number,
            subtotal=subtotal,
            tax_amount=tax_amount,
            discount_amount=discount_amount,
            total_amount=total_amount,
            **validated_data,
        )

        for item_data in calculated_items:
            item_data.pop("sale", None)

            SaleItem.objects.create(
                sale=sale,
                organization=organization,
                **item_data,
            )

        return sale

    @transaction.atomic
    def update(self, instance, validated_data):
        if instance.status != "draft":
            raise serializers.ValidationError(
                "Only draft sales can be edited."
            )

        items_data = validated_data.pop(
            "items",
            None,
        )

        if items_data is not None:
            (
                subtotal,
                tax_amount,
                discount_amount,
                total_amount,
                calculated_items,
            ) = self.calculate_totals(items_data)

            instance.subtotal = subtotal
            instance.tax_amount = tax_amount
            instance.discount_amount = discount_amount
            instance.total_amount = total_amount

            instance.items.all().delete()

            for item_data in calculated_items:
                item_data.pop("sale", None)

                SaleItem.objects.create(
                    sale=instance,
                    organization=instance.organization,
                    **item_data,
                )

        validated_data.pop(
            "organization",
            None,
        )

        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        instance.save()

        return instance


class SalePaymentSerializer(
    OrganizationAwareSerializerMixin,
    serializers.ModelSerializer,
):
    class Meta:
        model = SalePayment
        fields = [
            "id",
            "sale",
            "amount",
            "payment_method",
            "reference",
            "notes",
            "received_by",
            "created_at",
        ]

        read_only_fields = [
            "id",
            "received_by",
            "created_at",
        ]

    def validate_sale(self, value):
        return self.validate_organization_object(
            value,
            "sale",
        )

    def validate_amount(self, value):
        if value <= 0:
            raise serializers.ValidationError(
                "Payment amount must be greater than zero."
            )

        return value


class SaleRefundSerializer(
    OrganizationAwareSerializerMixin,
    serializers.ModelSerializer,
):
    class Meta:
        model = SaleRefund
        fields = [
            "id",
            "refund_number",
            "sale",
            "sale_return",
            "amount",
            "refund_method",
            "reference",
            "reason",
            "processed_by",
            "created_at",
        ]

        read_only_fields = [
            "id",
            "refund_number",
            "processed_by",
            "created_at",
        ]

    def validate_sale(self, value):
        return self.validate_organization_object(
            value,
            "sale",
        )

    def validate_sale_return(self, value):
        return self.validate_organization_object(
            value,
            "sale_return",
        )

    def validate_amount(self, value):
        if value <= 0:
            raise serializers.ValidationError(
                "Refund amount must be greater than zero."
            )

        return value


class SaleReturnItemSerializer(
    OrganizationAwareSerializerMixin,
    serializers.ModelSerializer,
):
    sale_return = serializers.PrimaryKeyRelatedField(
        queryset=SaleReturn.objects.all(),
        required=False,
    )

    sold_quantity = serializers.SerializerMethodField()
    returned_quantity = serializers.SerializerMethodField()
    available_quantity = serializers.SerializerMethodField()
    return_subtotal = serializers.SerializerMethodField()
    return_tax = serializers.SerializerMethodField()
    return_total = serializers.SerializerMethodField()

    class Meta:
        model = SaleReturnItem
        fields = [
            "id",
            "sale_return",
            "sale_item",
            "quantity",
            "sold_quantity",
            "returned_quantity",
            "available_quantity",
            "return_subtotal",
            "return_tax",
            "return_total",
            "created_at",
        ]

        read_only_fields = [
            "id",
            "sold_quantity",
            "returned_quantity",
            "available_quantity",
            "return_subtotal",
            "return_tax",
            "return_total",
            "created_at",
        ]

    def validate_sale_return(self, value):
        return self.validate_organization_object(
            value,
            "sale_return",
        )

    def validate_sale_item(self, value):
        return self.validate_organization_object(
            value,
            "sale_item",
        )

    def validate_quantity(self, value):
        if value <= 0:
            raise serializers.ValidationError(
                "Return quantity must be greater than zero."
            )

        return value

    def validate(self, attrs):
        sale_return = attrs.get("sale_return")
        sale_item = attrs.get("sale_item")

        if sale_return and sale_item:
            if sale_item.sale_id != sale_return.sale_id:
                raise serializers.ValidationError(
                    {
                        "sale_item": (
                            "The sale item must belong to "
                            "the sale being returned."
                        )
                    }
                )

            if sale_return.status != "pending":
                raise serializers.ValidationError(
                    {
                        "sale_return": (
                            "Items can only be added "
                            "to pending returns."
                        )
                    }
                )

        return attrs

    def _returned_before_current(self, obj):
        return sum(
            item.quantity
            for item in obj.sale_item.return_items.filter(
                organization=obj.organization,
                sale_return__status="completed",
            ).exclude(
                sale_return=obj.sale_return,
            )
        )

    def get_sold_quantity(self, obj):
        return obj.sale_item.quantity

    def get_returned_quantity(self, obj):
        return self._returned_before_current(obj)

    def get_available_quantity(self, obj):
        return (
            obj.sale_item.quantity
            - self._returned_before_current(obj)
        )

    def _financials(self, obj):
        sale_item = obj.sale_item

        proportion = (
            obj.quantity / sale_item.quantity
        )

        gross = (
            sale_item.unit_price * obj.quantity
        )

        discount = (
            sale_item.discount_amount * proportion
        )

        taxable = gross - discount

        tax = (
            taxable
            * sale_item.tax_rate
            / Decimal("100")
        )

        total = taxable + tax

        return {
            "subtotal": gross,
            "tax": tax,
            "total": total,
        }

    def get_return_subtotal(self, obj):
        return self._financials(obj)["subtotal"]

    def get_return_tax(self, obj):
        return self._financials(obj)["tax"]

    def get_return_total(self, obj):
        return self._financials(obj)["total"]


class SaleReturnSerializer(
    OrganizationAwareSerializerMixin,
    serializers.ModelSerializer,
):
    items = SaleReturnItemSerializer(many=True)

    total_subtotal = serializers.SerializerMethodField()
    total_tax = serializers.SerializerMethodField()
    total_refund = serializers.SerializerMethodField()

    class Meta:
        model = SaleReturn

        fields = [
            "id",
            "return_number",
            "sale",
            "reason",
            "status",
            "created_by",
            "created_at",
            "items",
            "total_subtotal",
            "total_tax",
            "total_refund",
        ]

        read_only_fields = [
            "id",
            "return_number",
            "created_by",
            "created_at",
            "total_subtotal",
            "total_tax",
            "total_refund",
        ]

    def validate_sale(self, value):
        return self.validate_organization_object(
            value,
            "sale",
        )

    def validate_items(self, value):
        if not value:
            raise serializers.ValidationError(
                "A return must contain at least one item."
            )

        return value

    def validate(self, attrs):
        organization = self.get_current_organization()

        sale = attrs.get("sale")

        if sale and sale.organization_id != organization.id:
            raise serializers.ValidationError(
                {
                    "sale": (
                        "This sale belongs to another organization."
                    )
                }
            )

        if sale:
            if sale.status != "completed":
                raise serializers.ValidationError(
                    {
                        "sale": (
                            "Only completed sales can "
                            "have returns."
                        )
                    }
                )

            if sale.payment_status != "paid":
                raise serializers.ValidationError(
                    {
                        "sale": (
                            "The sale must be fully paid "
                            "before it can be returned."
                        )
                    }
                )

        items = attrs.get("items")

        if items and sale:
            for item in items:
                sale_item = item.get("sale_item")

                if not sale_item:
                    continue

                if sale_item.organization_id != organization.id:
                    raise serializers.ValidationError(
                        {
                            "items": (
                                "All sale items must belong "
                                "to the current organization."
                            )
                        }
                    )

                if sale_item.sale_id != sale.id:
                    raise serializers.ValidationError(
                        {
                            "items": (
                                "Every returned item must "
                                "belong to the selected sale."
                            )
                        }
                    )

                already_returned = sum(
                    existing.quantity
                    for existing in sale_item.return_items.filter(
                        organization=organization,
                        sale_return__status="completed",
                    )
                )

                available_quantity = (
                    sale_item.quantity
                    - already_returned
                )

                requested_quantity = item["quantity"]

                if requested_quantity > available_quantity:
                    raise serializers.ValidationError(
                        {
                            "items": (
                                f"Cannot return "
                                f"{requested_quantity} of "
                                f"{sale_item.product.name}. "
                                f"Only "
                                f"{available_quantity} "
                                f"is available for return."
                            )
                        }
                    )

        return attrs

    def _calculate_totals(self, obj):
        subtotal = Decimal("0.00")
        tax = Decimal("0.00")
        total = Decimal("0.00")

        for item in obj.items.select_related("sale_item"):
            sale_item = item.sale_item

            proportion = (
                item.quantity / sale_item.quantity
            )

            gross = (
                sale_item.unit_price * item.quantity
            )

            discount = (
                sale_item.discount_amount
                * proportion
            )

            taxable = gross - discount

            item_tax = (
                taxable
                * sale_item.tax_rate
                / Decimal("100")
            )

            subtotal += gross
            tax += item_tax
            total += taxable + item_tax

        return subtotal, tax, total

    def get_total_subtotal(self, obj):
        return self._calculate_totals(obj)[0]

    def get_total_tax(self, obj):
        return self._calculate_totals(obj)[1]

    def get_total_refund(self, obj):
        return self._calculate_totals(obj)[2]

    @transaction.atomic
    def create(self, validated_data):
        items_data = validated_data.pop("items")
        organization = validated_data["organization"]

        # Lock organization row so return-number generation
        # remains safe under concurrent requests.
        organization.__class__.objects.select_for_update().get(
            pk=organization.pk,
        )

        existing_numbers = (
            SaleReturn.objects
            .filter(
                organization=organization,
                return_number__startswith="RET-",
            )
            .values_list(
                "return_number",
                flat=True,
            )
        )

        highest_number = 0

        for return_number in existing_numbers:
            try:
                sequence = int(
                    return_number.replace(
                        "RET-",
                        "",
                        1,
                    )
                )

                highest_number = max(
                    highest_number,
                    sequence,
                )

            except ValueError:
                continue

        next_number = highest_number + 1

        generated_return_number = (
            f"RET-{next_number:06d}"
        )

        sale_return = SaleReturn.objects.create(
            **validated_data,
            return_number=generated_return_number,
        )

        for item_data in items_data:
            item_data.pop(
                "sale_return",
                None,
            )

            SaleReturnItem.objects.create(
                sale_return=sale_return,
                organization=organization,
                **item_data,
            )

        return sale_return