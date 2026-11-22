from collections import Counter
from decimal import Decimal

from django.db.models import DecimalField, F, Sum
from django.db.models.functions import Coalesce
from django.utils.dateparse import parse_date

from sales.models import SaleRefund, SaleReturn, SaleReturnItem


def _zero_decimal():
    return Decimal("0.00")


def get_returns_analysis(
    organization,
    date_from=None,
    date_to=None,
    limit=10,
):
    """
    Read-only return & refund analysis scoped to an organization.
    """
    safe_limit = limit if isinstance(limit, int) and limit > 0 else 10
    safe_limit = min(safe_limit, 50)

    qs = SaleReturn.objects.filter(organization=organization)

    parsed_from = parse_date(date_from) if isinstance(date_from, str) else None
    parsed_to = parse_date(date_to) if isinstance(date_to, str) else None

    if parsed_from:
        qs = qs.filter(created_at__date__gte=parsed_from)
    if parsed_to:
        qs = qs.filter(created_at__date__lte=parsed_to)

    status_counts = {
        "pending": qs.filter(status="pending").count(),
        "completed": qs.filter(status="completed").count(),
        "cancelled": qs.filter(status="cancelled").count(),
    }
    total_returns = sum(status_counts.values())

    # Common return reasons (normalized for grouping, preserving readable text)
    reason_counter = Counter()
    display_reasons = {}
    for reason in qs.values_list("reason", flat=True):
        cleaned = (reason or "").strip()
        if not cleaned:
            cleaned = "No reason specified"
        key = cleaned.lower()
        reason_counter[key] += 1
        display_reasons.setdefault(key, cleaned)

    common_reasons = [
        {
            "reason": display_reasons[key],
            "count": count,
        }
        for key, count in reason_counter.most_common(safe_limit)
    ]

    # Refunded amount tied to returns in the filtered set
    completed_return_ids = qs.filter(status="completed").values_list("id", flat=True)
    refund_agg = SaleRefund.objects.filter(
        organization=organization,
        sale_return_id__in=completed_return_ids,
    ).aggregate(
        total_refunded=Coalesce(
            Sum("amount"),
            _zero_decimal(),
            output_field=DecimalField(max_digits=14, decimal_places=2),
        )
    )

    # Most returned products (across non-cancelled returns)
    active_return_ids = qs.exclude(status="cancelled").values_list("id", flat=True)
    items_qs = (
        SaleReturnItem.objects.filter(
            organization=organization,
            sale_return_id__in=active_return_ids,
        )
        .values(
            product_id=F("sale_item__product_id"),
            product_name=F("sale_item__product__name"),
            sku=F("sale_item__product__sku"),
        )
        .annotate(
            total_quantity_returned=Coalesce(
                Sum("quantity"),
                _zero_decimal(),
                output_field=DecimalField(max_digits=14, decimal_places=2),
            ),
            estimated_return_value=Coalesce(
                Sum(
                    F("quantity") * F("sale_item__unit_price"),
                    output_field=DecimalField(max_digits=14, decimal_places=2),
                ),
                _zero_decimal(),
                output_field=DecimalField(max_digits=14, decimal_places=2),
            ),
        )
        .order_by("-total_quantity_returned", "-estimated_return_value")[:safe_limit]
    )

    top_returned_products = [
        {
            "product_id": row["product_id"],
            "product_name": row["product_name"],
            "sku": row["sku"] or "",
            "quantity_returned": float(row["total_quantity_returned"]),
            "estimated_value_kes": float(row["estimated_return_value"]),
        }
        for row in items_qs
    ]

    return {
        "currency": "KES",
        "date_from": parsed_from.isoformat() if parsed_from else None,
        "date_to": parsed_to.isoformat() if parsed_to else None,
        "total_returns": total_returns,
        "status_breakdown": status_counts,
        "total_refunded_kes": float(refund_agg["total_refunded"]),
        "common_reasons": common_reasons,
        "top_returned_products": top_returned_products,
    }