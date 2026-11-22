from decimal import Decimal
from uuid import uuid4

from django.db import transaction
from rest_framework.exceptions import ValidationError

from core.services import create_audit_log
from inventory.models import InventoryItem, StockMovement
from receipts.services import revoke_receipt_for_sale

from .models import SaleRefund, SaleReturn


REFUND_METHODS = {
    "cash",
    "mpesa",
    "card",
    "bank_transfer",
}


def calculate_return_financials(return_items):
    """
    Calculate the financial effect of returned quantities.

    Discount and tax are allocated proportionally to the
    quantity being returned.
    """

    subtotal = Decimal("0.00")
    discount = Decimal("0.00")
    tax = Decimal("0.00")
    total = Decimal("0.00")

    for return_item in return_items:
        sale_item = return_item.sale_item

        sale_quantity = sale_item.quantity
        return_quantity = return_item.quantity

        if sale_quantity <= 0:
            raise ValidationError(
                "Sale item quantity must be greater than zero."
            )

        proportion = (
            return_quantity / sale_quantity
        )

        gross_value = (
            sale_item.unit_price * return_quantity
        )

        discount_value = (
            sale_item.discount_amount * proportion
        )

        taxable_value = (
            gross_value - discount_value
        )

        tax_value = (
            taxable_value
            * sale_item.tax_rate
            / Decimal("100")
        )

        line_total = taxable_value + tax_value

        subtotal += gross_value
        discount += discount_value
        tax += tax_value
        total += line_total

    return {
        "subtotal": subtotal,
        "discount": discount,
        "tax": tax,
        "total": total,
    }


def get_refund_method(
    *,
    sale,
    refund_method=None,
    organization,
):
    """
    Determine the refund method.

    If all recorded payments used one method, that method can
    be used automatically. If multiple payment methods were
    used, the caller must explicitly choose the refund method.
    """

    if refund_method:
        if refund_method not in REFUND_METHODS:
            raise ValidationError(
                {
                    "refund_method": (
                        "Invalid refund method. "
                        "Use cash, mpesa, card, or bank_transfer."
                    )
                }
            )
        return refund_method

    payment_methods = set(
        sale.payments
        .filter(
            organization=organization,
        )
        .values_list(
            "payment_method",
            flat=True,
        )
    )

    if len(payment_methods) == 1:
        method = next(iter(payment_methods))

        if method in REFUND_METHODS:
            return method

    raise ValidationError(
        {
            "refund_method": (
                "A refund method is required because this sale "
                "was paid using multiple payment methods."
            )
        }
    )


@transaction.atomic
def complete_sale_return(
    *,
    sale_return,
    user,
    organization,
    refund_method=None,
    refund_reference="",
):
    """
    Complete a customer return.

    The operation:
    1. Locks the return and sale.
    2. Validates return quantities and status.
    3. Restores inventory.
    4. Calculates the returned financial value.
    5. Creates an immutable refund ledger entry.
    6. Marks the return completed.
    7. Marks the sale returned if every item is returned, and revokes its receipt.
    """

    if sale_return.organization_id != organization.id:
        raise ValidationError(
            "You cannot complete a return from another organization."
        )

    sale_return = (
        SaleReturn.objects
        .select_for_update()
        .select_related("sale")
        .get(
            pk=sale_return.pk,
            organization=organization,
        )
    )

    current_status = (sale_return.status or "").strip().lower()
    if current_status != "pending":
        raise ValidationError(
            f"Only pending returns can be completed (current status: {sale_return.status!r})."
        )

    sale = (
        sale_return.sale.__class__.objects
        .select_for_update()
        .get(
            pk=sale_return.sale_id,
            organization=organization,
        )
    )

    if sale.organization_id != organization.id:
        raise ValidationError(
            "The sale belongs to another organization."
        )

    if sale.status != "completed":
        raise ValidationError(
            "Only completed sales can have items returned."
        )

    if sale.payment_status != "paid":
        raise ValidationError(
            "A sale must be fully paid before it can be returned."
        )

    return_items = list(
        sale_return.items
        .select_related(
            "sale_item",
            "sale_item__product",
        )
        .filter(
            organization=organization,
        )
    )

    if not return_items:
        raise ValidationError(
            "A return must contain at least one item."
        )

    # Validate tenant ownership and sale relationships.
    for return_item in return_items:
        if return_item.organization_id != organization.id:
            raise ValidationError(
                "A return item belongs to another organization."
            )

        sale_item = return_item.sale_item

        if sale_item.organization_id != organization.id:
            raise ValidationError(
                "A sale item belongs to another organization."
            )

        if sale_item.sale_id != sale.id:
            raise ValidationError(
                "A returned item does not belong to the selected sale."
            )

        if sale_item.product.organization_id != organization.id:
            raise ValidationError(
                f"Product {sale_item.product.name} belongs "
                "to another organization."
            )

    # Lock all sale items involved in this return.
    sale_item_ids = [
        item.sale_item_id
        for item in return_items
    ]

    locked_sale_items = {
        item.id: item
        for item in sale.items
        .select_for_update()
        .select_related("product")
        .filter(
            organization=organization,
            id__in=sale_item_ids,
        )
    }

    # Validate available quantities.
    for return_item in return_items:
        sale_item = locked_sale_items.get(
            return_item.sale_item_id
        )

        if sale_item is None:
            raise ValidationError(
                "A returned sale item could not be found."
            )

        if return_item.quantity <= 0:
            raise ValidationError(
                "Return quantity must be greater than zero."
            )

        already_returned = sum(
            item.quantity
            for item in sale_item.return_items
            .select_related("sale_return")
            .filter(
                organization=organization,
                sale_return__status="completed",
            )
            .exclude(
                sale_return=sale_return,
            )
        )

        remaining_quantity = (
            sale_item.quantity - already_returned
        )

        if return_item.quantity > remaining_quantity:
            raise ValidationError(
                f"Cannot return {return_item.quantity} of "
                f"{sale_item.product.name}. "
                f"Only {remaining_quantity} remains available."
            )

    # Calculate the financial reversal before changing anything.
    financials = calculate_return_financials(
        return_items
    )

    refund_amount = financials["total"]

    if refund_amount <= Decimal("0.00"):
        raise ValidationError(
            "The return has no refundable value."
        )

    # Never refund more than the amount actually paid.
    existing_refunds = sum(
        refund.amount
        for refund in sale.refunds.filter(
            organization=organization,
        )
    )

    refundable_balance = (
        sale.amount_paid - existing_refunds
    )

    if refund_amount > refundable_balance:
        raise ValidationError(
            f"Refund exceeds the remaining refundable balance. "
            f"Available: {refundable_balance}."
        )

    selected_refund_method = get_refund_method(
        sale=sale,
        refund_method=refund_method,
        organization=organization,
    )

    # Lock inventory records.
    product_ids = [
        item.sale_item.product_id
        for item in return_items
    ]

    inventory_items = (
        InventoryItem.objects
        .select_for_update()
        .select_related("product")
        .filter(
            organization=organization,
            product_id__in=product_ids,
            is_active=True,
        )
    )

    inventory_by_product = {
        item.product_id: item
        for item in inventory_items
    }

    for return_item in return_items:
        product = return_item.sale_item.product

        if product.id not in inventory_by_product:
            raise ValidationError(
                f"No active inventory record exists for "
                f"{product.name}."
            )

    # Restore inventory.
    for return_item in return_items:
        sale_item = return_item.sale_item
        inventory_item = inventory_by_product[
            sale_item.product_id
        ]

        inventory_item.quantity += return_item.quantity

        inventory_item.save(
            update_fields=[
                "quantity",
                "updated_at",
            ]
        )

        StockMovement.objects.create(
            organization=organization,
            inventory_item=inventory_item,
            sale=sale,
            movement_type="return_in",
            quantity=return_item.quantity,
            reference=sale_return.return_number,
            notes=(
                f"Customer return for sale "
                f"{sale.sale_number}."
            ),
            created_by=user,
        )

    # Create immutable financial refund record.
    refund = SaleRefund.objects.create(
        organization=organization,
        refund_number=f"REF-{uuid4().hex[:10].upper()}",
        sale=sale,
        sale_return=sale_return,
        amount=refund_amount,
        refund_method=selected_refund_method,
        reference=refund_reference,
        reason=sale_return.reason,
        processed_by=user,
    )

    # Complete the return.
    sale_return.status = "completed"

    sale_return.save(
        update_fields=["status"]
    )

    # Determine whether every sale item has now been returned.
    sale_items = list(
        sale.items.filter(
            organization=organization,
        )
    )

    fully_returned = True

    for sale_item in sale_items:
        returned_quantity = sum(
            item.quantity
            for item in sale_item.return_items.filter(
                organization=organization,
                sale_return__status="completed",
            )
        )

        if returned_quantity < sale_item.quantity:
            fully_returned = False
            break

    if fully_returned:
        sale.status = "returned"

        sale.save(
            update_fields=[
                "status",
                "updated_at",
            ]
        )

        revoke_receipt_for_sale(
            sale,
            reason=f"Sale returned ({sale_return.return_number})",
        )

    create_audit_log(
        user=user,
        organization=organization,
        action="complete",
        model_name="SaleReturn",
        object_id=sale_return.id,
        description=(
            f"Customer return {sale_return.return_number} "
            f"completed for sale {sale.sale_number}. "
            f"Refund {refund.refund_number}: "
            f"{refund.amount}."
        ),
    )

    return sale_return