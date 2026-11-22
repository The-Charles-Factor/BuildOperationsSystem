from decimal import Decimal

from django.db import models, transaction
from rest_framework.exceptions import ValidationError

from core.services import create_audit_log

from .models import Purchase, PurchasePayment


@transaction.atomic
def make_purchase_payment(
    *,
    purchase,
    amount,
    payment_method,
    paid_by,
    reference="",
    notes="",
    organization,
):
    if purchase.organization_id != organization.id:
        raise ValidationError(
            "You cannot make a payment for a purchase "
            "from another organization."
        )

    purchase = (
        Purchase.objects
        .select_for_update()
        .get(
            pk=purchase.pk,
            organization=organization,
        )
    )

    if purchase.status in [
        "draft",
        "cancelled",
    ]:
        raise ValidationError(
            "Payments can only be made for "
            "ordered or received purchases."
        )

    amount = Decimal(amount)

    if amount <= Decimal("0.00"):
        raise ValidationError(
            "Payment amount must be greater than zero."
        )

    total_paid = (
        PurchasePayment.objects
        .filter(
            purchase=purchase,
            organization=organization,
        )
        .aggregate(
            total=models.Sum("amount")
        )["total"]
        or Decimal("0.00")
    )

    remaining = (
        purchase.total_amount
        - total_paid
    )

    if amount > remaining:
        raise ValidationError(
            f"Payment exceeds the outstanding balance "
            f"of {remaining}."
        )

    payment = PurchasePayment.objects.create(
        organization=organization,
        purchase=purchase,
        amount=amount,
        payment_method=payment_method,
        reference=reference,
        notes=notes,
        paid_by=paid_by,
    )

    new_total_paid = total_paid + amount

    if new_total_paid >= purchase.total_amount:
        purchase.payment_status = "paid"
    else:
        purchase.payment_status = "partially_paid"

    purchase.save(
        update_fields=[
            "payment_status",
            "updated_at",
        ]
    )

    create_audit_log(
        user=paid_by,
        organization=organization,
        action="pay",
        model_name="Purchase",
        object_id=purchase.id,
        description=(
            f"Payment of {amount} made for "
            f"purchase {purchase.purchase_number} "
            f"using {payment_method}. "
            f"Payment status: {purchase.payment_status}."
        ),
    )

    return payment