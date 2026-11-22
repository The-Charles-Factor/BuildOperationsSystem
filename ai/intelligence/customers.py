from decimal import Decimal

from django.db.models import DecimalField, Sum
from django.db.models.functions import Coalesce

from sales.models import Sale

from ai.intelligence.utils import (
    validate_date_range,
    validate_limit,
)


ZERO = Decimal("0.00")


def get_customer_receivables(
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

    sales = Sale.objects.filter(
        organization=organization,
        status="completed",
    )

    if date_from:
        sales = sales.filter(
            sale_date__date__gte=date_from
        )

    if date_to:
        sales = sales.filter(
            sale_date__date__lte=date_to
        )

    customers = (
        sales
        .values(
            "customer_id",
            "customer__name",
            "customer__company_name",
        )
        .annotate(
            total_sales=Coalesce(
                Sum("total_amount"),
                ZERO,
                output_field=DecimalField(
                    max_digits=14,
                    decimal_places=2,
                ),
            ),
            amount_paid=Coalesce(
                Sum("amount_paid"),
                ZERO,
                output_field=DecimalField(
                    max_digits=14,
                    decimal_places=2,
                ),
            ),
        )
        .order_by("-total_sales")
    )

    results = []

    for customer in customers:
        outstanding = (
            customer["total_sales"]
            - customer["amount_paid"]
        )

        if outstanding > ZERO:
            results.append(
                {
                    "customer_id": customer["customer_id"],
                    "customer_name": customer["customer__name"],
                    "company_name": (
                        customer["customer__company_name"]
                        or ""
                    ),
                    "total_sales": customer["total_sales"],
                    "amount_paid": customer["amount_paid"],
                    "outstanding_amount": outstanding,
                }
            )

    return results[:limit]