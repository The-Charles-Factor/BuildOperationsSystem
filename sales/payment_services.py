from decimal import Decimal

from django.db import transaction
from django.db.models import Sum
from rest_framework.exceptions import ValidationError

from .models import Sale, SalePayment


@transaction.atomic
def record_sale_payment(
    *,
    sale,
    amount,
    payment_method,
    received_by,
    reference="",
    notes="",
    organization,
):
    """
    Record a payment against a completed sale.

    SalePayment records are the authoritative payment ledger.
    Sale.amount_paid and Sale.payment_status are synchronized
    from the ledger.

    Payments cannot be added once the sale is fully paid.
    """

    if sale.organization_id != organization.id:
        raise ValidationError(
            "You cannot record a payment for a sale "
            "from another organization."
        )

    sale = (
        Sale.objects
        .select_for_update()
        .get(
            pk=sale.pk,
            organization=organization,
        )
    )

    if sale.status == "cancelled":
        raise ValidationError(
            "Cannot record a payment for a cancelled sale."
        )

    if sale.status == "returned":
        raise ValidationError(
            "Cannot record a payment for a returned sale."
        )

    if sale.status != "completed":
        raise ValidationError(
            "Payments can only be recorded for completed sales."
        )

    amount = Decimal(amount)

    if amount <= 0:
        raise ValidationError(
            "Payment amount must be greater than zero."
        )

    ledger_total = (
        SalePayment.objects
        .filter(
            sale=sale,
            organization=organization,
        )
        .aggregate(total=Sum("amount"))
        .get("total")
        or Decimal("0.00")
    )

    outstanding_balance = (
        sale.total_amount - ledger_total
    )

    if outstanding_balance <= Decimal("0.00"):
        raise ValidationError(
            "This sale is already fully paid. "
            "No further payment can be recorded."
        )

    if amount > outstanding_balance:
        raise ValidationError(
            f"Payment exceeds the outstanding balance. "
            f"Outstanding: {outstanding_balance}."
        )

    payment = SalePayment.objects.create(
        organization=organization,
        sale=sale,
        amount=amount,
        payment_method=payment_method,
        reference=reference,
        notes=notes,
        received_by=received_by,
    )

    new_total_paid = ledger_total + amount

    sale.amount_paid = new_total_paid

    if new_total_paid >= sale.total_amount:
        sale.amount_paid = sale.total_amount
        sale.payment_status = "paid"
    elif new_total_paid > Decimal("0.00"):
        sale.payment_status = "partially_paid"
    else:
        sale.payment_status = "unpaid"

    sale.save(
        update_fields=[
            "amount_paid",
            "payment_status",
            "updated_at",
        ]
    )

    return payment