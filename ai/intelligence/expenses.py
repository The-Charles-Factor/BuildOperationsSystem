from decimal import Decimal

from django.db.models import Count, DecimalField, F, Q, Sum
from django.db.models.functions import Coalesce
from django.utils.dateparse import parse_date

from expenses.models import Expense


def _zero_decimal():
    return Decimal("0.00")


def get_expenses_summary(
    organization,
    date_from=None,
    date_to=None,
    limit=10,
):
    """
    Read-only expense summary scoped to an organization.
    """
    safe_limit = limit if isinstance(limit, int) and limit > 0 else 10
    safe_limit = min(safe_limit, 50)

    qs = Expense.objects.filter(organization=organization)

    parsed_from = parse_date(date_from) if isinstance(date_from, str) else None
    parsed_to = parse_date(date_to) if isinstance(date_to, str) else None

    if parsed_from:
        qs = qs.filter(expense_date__date__gte=parsed_from)
    if parsed_to:
        qs = qs.filter(expense_date__date__lte=parsed_to)

    active_qs = qs.exclude(status="cancelled")

    totals_by_status = {
        row["status"]: {
            "count": row["count"],
            "amount_kes": float(row["total_amount"]),
        }
        for row in qs.values("status").annotate(
            count=Count("id"),
            total_amount=Coalesce(
                Sum("amount"),
                _zero_decimal(),
                output_field=DecimalField(max_digits=14, decimal_places=2),
            ),
        )
    }

    committed_agg = active_qs.aggregate(
        total_amount=Coalesce(
            Sum("amount"),
            _zero_decimal(),
            output_field=DecimalField(max_digits=14, decimal_places=2),
        ),
        paid_amount=Coalesce(
            Sum(
                "amount",
                filter=Q(status="paid"),
            ),
            _zero_decimal(),
            output_field=DecimalField(max_digits=14, decimal_places=2),
        ),
    )

    by_category = [
        {
            "category": row["category_name"] or "Uncategorized",
            "count": row["count"],
            "amount_kes": float(row["total_amount"]),
        }
        for row in (
            active_qs.values(category_name=F("category__name"))
            .annotate(
                count=Count("id"),
                total_amount=Coalesce(
                    Sum("amount"),
                    _zero_decimal(),
                    output_field=DecimalField(max_digits=14, decimal_places=2),
                ),
            )
            .order_by("-total_amount")[:safe_limit]
        )
    ]

    by_payment_method = [
        {
            "payment_method": row["payment_method"] or "unspecified",
            "count": row["count"],
            "amount_kes": float(row["total_amount"]),
        }
        for row in (
            active_qs.values("payment_method")
            .annotate(
                count=Count("id"),
                total_amount=Coalesce(
                    Sum("amount"),
                    _zero_decimal(),
                    output_field=DecimalField(max_digits=14, decimal_places=2),
                ),
            )
            .order_by("-total_amount")
        )
    ]

    recent_expenses = [
        {
            "expense_number": exp.expense_number,
            "description": exp.description,
            "category": exp.category.name if exp.category_id else "",
            "amount_kes": float(exp.amount),
            "status": exp.status,
            "payment_method": exp.payment_method or "",
            "paid_to": exp.paid_to,
            "expense_date": exp.expense_date.date().isoformat()
            if exp.expense_date
            else None,
        }
        for exp in qs.select_related("category").order_by("-expense_date")[:safe_limit]
    ]

    return {
        "currency": "KES",
        "date_from": parsed_from.isoformat() if parsed_from else None,
        "date_to": parsed_to.isoformat() if parsed_to else None,
        "total_non_cancelled_kes": float(committed_agg["total_amount"]),
        "total_paid_kes": float(committed_agg["paid_amount"]),
        "by_status": totals_by_status,
        "by_category": by_category,
        "by_payment_method": by_payment_method,
        "recent_expenses": recent_expenses,
    }