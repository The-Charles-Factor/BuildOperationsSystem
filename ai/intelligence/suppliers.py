from decimal import Decimal

from django.db.models import DecimalField, Sum
from django.db.models.functions import Coalesce

from purchases.models import (
    Purchase,
    PurchasePayment,
)

from ai.intelligence.utils import (
    validate_date_range,
    validate_limit,
)


ZERO = Decimal("0.00")


def get_supplier_payables(
    organization,
    date_from=None,
    date_to=None,
    limit=50,
):
    date_from, date_to = validate_date_range(
        date_from,
        date_to,
    )

    limit = validate_limit(limit)

    purchases = (
        Purchase.objects
        .filter(
            organization=organization,
        )
        .exclude(
            status="cancelled"
        )
    )

    if date_from:
        purchases = purchases.filter(
            purchase_date__date__gte=date_from
        )

    if date_to:
        purchases = purchases.filter(
            purchase_date__date__lte=date_to
        )

    purchase_ids = purchases.values_list(
        "id",
        flat=True,
    )

    payments = (
        PurchasePayment.objects
        .filter(
            organization=organization,
            purchase_id__in=purchase_ids,
            purchase__organization=organization,
        )
        .values("purchase_id")
        .annotate(
            total_paid=Coalesce(
                Sum("amount"),
                ZERO,
                output_field=DecimalField(
                    max_digits=14,
                    decimal_places=2,
                ),
            )
        )
    )

    payments_by_purchase = {
        payment["purchase_id"]: payment["total_paid"]
        for payment in payments
    }

    suppliers = {}

    for purchase in purchases.select_related(
        "supplier"
    ):
        supplier_id = purchase.supplier_id

        if supplier_id not in suppliers:
            suppliers[supplier_id] = {
                "supplier_id": supplier_id,
                "supplier_name": purchase.supplier.name,
                "company_name": (
                    purchase.supplier.company_name
                    or ""
                ),
                "purchase_value": ZERO,
                "amount_paid": ZERO,
            }

        suppliers[supplier_id]["purchase_value"] += (
            purchase.total_amount
        )

        suppliers[supplier_id]["amount_paid"] += (
            payments_by_purchase.get(
                purchase.id,
                ZERO,
            )
        )

    results = []

    for supplier in suppliers.values():
        outstanding = (
            supplier["purchase_value"]
            - supplier["amount_paid"]
        )

        if outstanding > ZERO:
            results.append(
                {
                    **supplier,
                    "outstanding_amount": outstanding,
                }
            )

    results.sort(
        key=lambda supplier:
            supplier["outstanding_amount"],
        reverse=True,
    )

    return results[:limit]