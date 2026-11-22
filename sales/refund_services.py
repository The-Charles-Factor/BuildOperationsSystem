from decimal import Decimal

from django.db import transaction
from django.db.models import Sum

from .models import Sale, SaleRefund


@transaction.atomic
def record_sale_refund(
    *,
    sale,
    amount,
    refund_method,
    processed_by,
    refund_number,
    reason,
    reference="",
    organization,
):
    if sale.organization_id != organization.id:
        raise ValueError(
            "The sale does not belong to the current organization."
        )

    sale = (
        Sale.objects
        .select_for_update()
        .filter(
            pk=sale.pk,
            organization=organization,
        )
        .first()
    )

    if sale is None:
        raise ValueError(
            "Sale not found in the current organization."
        )

    if sale.status not in {"completed", "returned"}:
        raise ValueError(
            "Only completed or returned sales can be refunded."
        )

    amount = Decimal(str(amount))

    if amount <= 0:
        raise ValueError(
            "Refund amount must be greater than zero."
        )

    total_paid = (
        sale.payments
        .filter(organization=organization)
        .aggregate(total=Sum("amount"))
        .get("total")
        or Decimal("0.00")
    )

    total_refunded = (
        SaleRefund.objects
        .filter(
            sale=sale,
            organization=organization,
        )
        .aggregate(total=Sum("amount"))
        .get("total")
        or Decimal("0.00")
    )

    refundable_amount = total_paid - total_refunded

    if amount > refundable_amount:
        raise ValueError(
            "Refund amount cannot exceed the refundable amount."
        )

    refund = SaleRefund.objects.create(
        organization=organization,
        refund_number=refund_number,
        sale=sale,
        amount=amount,
        refund_method=refund_method,
        reference=reference,
        reason=reason,
        processed_by=processed_by,
    )

    return refund