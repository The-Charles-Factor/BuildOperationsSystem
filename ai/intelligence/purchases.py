from decimal import Decimal

from django.db.models import Count, DecimalField, F, Sum
from django.db.models.functions import Coalesce
from django.utils.dateparse import parse_date

from purchases.models import Purchase, PurchaseItem, PurchasePayment


def _zero_decimal():
    return Decimal("0.00")


def get_purchases_overview(
    organization,
    date_from=None,
    date_to=None,
    limit=10,
):
    """
    Read-only purchase order, receiving, and payment summary scoped to an organization.
    """
    safe_limit = limit if isinstance(limit, int) and limit > 0 else 10
    safe_limit = min(safe_limit, 50)

    qs = Purchase.objects.filter(organization=organization)

    parsed_from = parse_date(date_from) if isinstance(date_from, str) else None
    parsed_to = parse_date(date_to) if isinstance(date_to, str) else None

    if parsed_from:
        qs = qs.filter(purchase_date__date__gte=parsed_from)
    if parsed_to:
        qs = qs.filter(purchase_date__date__lte=parsed_to)

    active_qs = qs.exclude(status="cancelled")

    by_status = {
        row["status"]: {
            "count": row["count"],
            "total_amount_kes": float(row["total_amount"]),
        }
        for row in qs.values("status").annotate(
            count=Count("id"),
            total_amount=Coalesce(
                Sum("total_amount"),
                _zero_decimal(),
                output_field=DecimalField(max_digits=14, decimal_places=2),
            ),
        )
    }

    by_payment_status = {
        row["payment_status"]: {
            "count": row["count"],
            "total_amount_kes": float(row["total_amount"]),
        }
        for row in active_qs.values("payment_status").annotate(
            count=Count("id"),
            total_amount=Coalesce(
                Sum("total_amount"),
                _zero_decimal(),
                output_field=DecimalField(max_digits=14, decimal_places=2),
            ),
        )
    }

    purchase_ids = active_qs.values_list("id", flat=True)

    totals_agg = active_qs.aggregate(
        total_purchase_value=Coalesce(
            Sum("total_amount"),
            _zero_decimal(),
            output_field=DecimalField(max_digits=14, decimal_places=2),
        ),
        total_subtotal=Coalesce(
            Sum("subtotal"),
            _zero_decimal(),
            output_field=DecimalField(max_digits=14, decimal_places=2),
        ),
        total_tax=Coalesce(
            Sum("tax_amount"),
            _zero_decimal(),
            output_field=DecimalField(max_digits=14, decimal_places=2),
        ),
        total_discount=Coalesce(
            Sum("discount_amount"),
            _zero_decimal(),
            output_field=DecimalField(max_digits=14, decimal_places=2),
        ),
    )

    paid_agg = PurchasePayment.objects.filter(
        organization=organization,
        purchase_id__in=purchase_ids,
    ).aggregate(
        total_paid=Coalesce(
            Sum("amount"),
            _zero_decimal(),
            output_field=DecimalField(max_digits=14, decimal_places=2),
        )
    )

    receiving_agg = PurchaseItem.objects.filter(
        organization=organization,
        purchase_id__in=purchase_ids,
    ).aggregate(
        ordered_qty=Coalesce(
            Sum("quantity"),
            _zero_decimal(),
            output_field=DecimalField(max_digits=14, decimal_places=2),
        ),
        received_qty=Coalesce(
            Sum("received_quantity"),
            _zero_decimal(),
            output_field=DecimalField(max_digits=14, decimal_places=2),
        ),
    )

    top_suppliers = [
        {
            "supplier_id": row["supplier_id"],
            "supplier_name": row["supplier_company"] or row["supplier_name"] or "",
            "purchase_count": row["purchase_count"],
            "total_purchased_kes": float(row["total_purchased"]),
        }
        for row in (
            active_qs.values(
                "supplier_id",
                supplier_name=F("supplier__name"),
                supplier_company=F("supplier__company_name"),
            )
            .annotate(
                purchase_count=Count("id"),
                total_purchased=Coalesce(
                    Sum("total_amount"),
                    _zero_decimal(),
                    output_field=DecimalField(max_digits=14, decimal_places=2),
                ),
            )
            .order_by("-total_purchased")[:safe_limit]
        )
    ]

    recent_purchases = [
        {
            "purchase_number": p.purchase_number,
            "supplier": p.supplier.company_name or p.supplier.name,
            "status": p.status,
            "payment_status": p.payment_status,
            "total_amount_kes": float(p.total_amount),
            "purchase_date": p.purchase_date.date().isoformat()
            if p.purchase_date
            else None,
            "expected_delivery_date": p.expected_delivery_date.isoformat()
            if p.expected_delivery_date
            else None,
        }
        for p in qs.select_related("supplier").order_by("-purchase_date")[:safe_limit]
    ]

    total_val = totals_agg["total_purchase_value"]
    total_paid = paid_agg["total_paid"]
    unpaid_balance = max(total_val - total_paid, _zero_decimal())
    ordered_qty = receiving_agg["ordered_qty"]
    received_qty = receiving_agg["received_qty"]

    return {
        "currency": "KES",
        "date_from": parsed_from.isoformat() if parsed_from else None,
        "date_to": parsed_to.isoformat() if parsed_to else None,
        "total_purchase_orders": qs.count(),
        "total_non_cancelled_value_kes": float(total_val),
        "subtotal_kes": float(totals_agg["total_subtotal"]),
        "tax_kes": float(totals_agg["total_tax"]),
        "discount_kes": float(totals_agg["total_discount"]),
        "total_paid_kes": float(total_paid),
        "unpaid_purchase_balance_kes": float(unpaid_balance),
        "ordered_quantity": float(ordered_qty),
        "received_quantity": float(received_qty),
        "pending_receive_quantity": float(max(ordered_qty - received_qty, _zero_decimal())),
        "by_status": by_status,
        "by_payment_status": by_payment_status,
        "top_suppliers": top_suppliers,
        "recent_purchases": recent_purchases,
    }