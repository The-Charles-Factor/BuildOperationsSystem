from decimal import Decimal

from django.db.models import Count, DecimalField, F, Sum
from django.db.models.functions import Coalesce

from customers.models import Customer


def _zero_decimal():
    return Decimal("0.00")


def get_customer_insights(
    organization,
    date_from=None,
    date_to=None,
    limit=10,
):
    """
    Read-only customer directory & purchase activity summary scoped to an organization.
    """
    safe_limit = limit if isinstance(limit, int) and limit > 0 else 10
    safe_limit = min(safe_limit, 50)

    customers_qs = Customer.objects.filter(organization=organization)

    status_counts = {
        row["status"]: row["count"]
        for row in customers_qs.values("status").annotate(count=Count("id"))
    }

    type_counts = {
        row["customer_type"]: row["count"]
        for row in customers_qs.values("customer_type").annotate(count=Count("id"))
    }

    completed_sales_filter = F("sales__status") == "completed"

    ranked_customers = (
        customers_qs.annotate(
            completed_orders=Count(
                "sales",
                filter=completed_sales_filter,
                distinct=True,
            ),
            total_purchased_kes=Coalesce(
                Sum(
                    "sales__total_amount",
                    filter=completed_sales_filter,
                ),
                _zero_decimal(),
                output_field=DecimalField(max_digits=14, decimal_places=2),
            ),
            total_paid_kes=Coalesce(
                Sum(
                    "sales__amount_paid",
                    filter=completed_sales_filter,
                ),
                _zero_decimal(),
                output_field=DecimalField(max_digits=14, decimal_places=2),
            ),
        )
        .order_by("-total_purchased_kes", "name")[:safe_limit]
    )

    top_customers = []
    for cust in ranked_customers:
        purchased = cust.total_purchased_kes or _zero_decimal()
        paid = cust.total_paid_kes or _zero_decimal()
        balance = max(purchased - paid, _zero_decimal())
        top_customers.append(
            {
                "id": cust.id,
                "name": cust.company_name or cust.name,
                "contact_name": cust.name,
                "customer_type": cust.customer_type,
                "status": cust.status,
                "phone": cust.phone,
                "credit_limit_kes": float(cust.credit_limit or 0),
                "completed_orders": cust.completed_orders,
                "total_purchased_kes": float(purchased),
                "outstanding_balance_kes": float(balance),
            }
        )

    return {
        "currency": "KES",
        "total_customers": customers_qs.count(),
        "status_breakdown": status_counts,
        "type_breakdown": type_counts,
        "top_customers": top_customers,
    }