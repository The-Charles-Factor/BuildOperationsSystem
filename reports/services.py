from decimal import Decimal

from django.db.models import (
    Count,
    DecimalField,
    F,
    Sum,
)
from django.db.models.functions import Coalesce

from expenses.models import Expense
from inventory.models import InventoryItem
from products.models import Product
from purchases.models import Purchase, PurchasePayment
from sales.models import Sale, SaleItem


ZERO = Decimal("0.00")


def apply_date_range(
    queryset,
    field_name,
    date_from=None,
    date_to=None,
):
    """
    Apply an optional inclusive date range to a queryset.

    date_from and date_to are expected to be date objects.
    """

    if date_from:
        queryset = queryset.filter(
            **{
                f"{field_name}__date__gte": date_from,
            }
        )

    if date_to:
        queryset = queryset.filter(
            **{
                f"{field_name}__date__lte": date_to,
            }
        )

    return queryset


def get_sales_summary(
    organization,
    date_from=None,
    date_to=None,
):
    """
    Return high-level sales metrics for one organization.
    """

    sales = Sale.objects.filter(
        organization=organization,
    )

    sales = apply_date_range(
        sales,
        "sale_date",
        date_from,
        date_to,
    )

    completed_sales = sales.filter(
        status__in=["completed", "returned"],
    )

    revenue = (
        completed_sales.aggregate(
            total=Coalesce(
                Sum("total_amount"),
                ZERO,
                output_field=DecimalField(
                    max_digits=14,
                    decimal_places=2,
                ),
            )
        )["total"]
    )

    amount_paid = (
        completed_sales.aggregate(
            total=Coalesce(
                Sum("amount_paid"),
                ZERO,
                output_field=DecimalField(
                    max_digits=14,
                    decimal_places=2,
                ),
            )
        )["total"]
    )

    outstanding = revenue - amount_paid

    return {
        "total_sales": sales.count(),
        "completed_sales": completed_sales.count(),
        "draft_sales": sales.filter(
            status="draft"
        ).count(),
        "cancelled_sales": sales.filter(
            status="cancelled"
        ).count(),
        "returned_sales": sales.filter(
            status="returned"
        ).count(),
        "revenue": revenue,
        "amount_paid": amount_paid,
        "outstanding_amount": outstanding,
    }


def get_purchase_summary(
    organization,
    date_from=None,
    date_to=None,
):
    """
    Return high-level purchase metrics for one organization.
    """

    purchases = Purchase.objects.filter(
        organization=organization,
    )

    purchases = apply_date_range(
        purchases,
        "purchase_date",
        date_from,
        date_to,
    )

    total_amount = (
        purchases.aggregate(
            total=Coalesce(
                Sum("total_amount"),
                ZERO,
                output_field=DecimalField(
                    max_digits=14,
                    decimal_places=2,
                ),
            )
        )["total"]
    )

    purchase_ids = purchases.values_list(
        "id",
        flat=True,
    )

    paid_amount = (
        PurchasePayment.objects
        .filter(
            organization=organization,
            purchase_id__in=purchase_ids,
        )
        .aggregate(
            total=Coalesce(
                Sum("amount"),
                ZERO,
                output_field=DecimalField(
                    max_digits=14,
                    decimal_places=2,
                ),
            )
        )["total"]
    )

    outstanding_amount = total_amount - paid_amount

    return {
        "total_purchases": purchases.count(),
        "draft_purchases": purchases.filter(
            status="draft"
        ).count(),
        "ordered_purchases": purchases.filter(
            status="ordered"
        ).count(),
        "partially_received": purchases.filter(
            status="partially_received"
        ).count(),
        "received_purchases": purchases.filter(
            status="received"
        ).count(),
        "cancelled_purchases": purchases.filter(
            status="cancelled"
        ).count(),
        "purchase_value": total_amount,
        "amount_paid": paid_amount,
        "outstanding_amount": outstanding_amount,
    }


def get_inventory_summary(
    organization,
):
    """
    Return current inventory metrics for one organization.

    Inventory is a current-state report, so it is not
    date-filtered.
    """

    inventory = InventoryItem.objects.filter(
        organization=organization,
        is_active=True,
    )

    total_products = Product.objects.filter(
        organization=organization,
        is_active=True,
    ).count()

    total_stock_quantity = (
        inventory.aggregate(
            total=Coalesce(
                Sum("quantity"),
                ZERO,
                output_field=DecimalField(
                    max_digits=14,
                    decimal_places=2,
                ),
            )
        )["total"]
    )

    low_stock_count = inventory.filter(
        quantity__lte=F("reorder_level"),
        reorder_level__gt=0,
    ).count()

    out_of_stock_count = inventory.filter(
        quantity__lte=0,
    ).count()

    return {
        "total_products": total_products,
        "inventory_items": inventory.count(),
        "total_stock_quantity": total_stock_quantity,
        "low_stock_items": low_stock_count,
        "out_of_stock_items": out_of_stock_count,
    }


def get_expense_summary(
    organization,
    date_from=None,
    date_to=None,
):
    """
    Return high-level expense metrics for one organization.
    """

    expenses = Expense.objects.filter(
        organization=organization,
    )

    expenses = apply_date_range(
        expenses,
        "expense_date",
        date_from,
        date_to,
    )

    total_amount = (
        expenses.aggregate(
            total=Coalesce(
                Sum("amount"),
                ZERO,
                output_field=DecimalField(
                    max_digits=14,
                    decimal_places=2,
                ),
            )
        )["total"]
    )

    paid_amount = (
        expenses.filter(
            status="paid"
        ).aggregate(
            total=Coalesce(
                Sum("amount"),
                ZERO,
                output_field=DecimalField(
                    max_digits=14,
                    decimal_places=2,
                ),
            )
        )["total"]
    )

    return {
        "total_expenses": expenses.count(),
        "pending_expenses": expenses.filter(
            status="pending"
        ).count(),
        "approved_expenses": expenses.filter(
            status="approved"
        ).count(),
        "paid_expenses": expenses.filter(
            status="paid"
        ).count(),
        "cancelled_expenses": expenses.filter(
            status="cancelled"
        ).count(),
        "total_amount": total_amount,
        "paid_amount": paid_amount,
    }


def get_financial_summary(
    organization,
    date_from=None,
    date_to=None,
):
    """
    Return a high-level financial overview.

    Purchase value is not treated as cost of goods sold.

    This is a management-level cash/transaction summary,
    not a formal accounting statement.
    """

    sales = get_sales_summary(
        organization=organization,
        date_from=date_from,
        date_to=date_to,
    )

    purchases = get_purchase_summary(
        organization=organization,
        date_from=date_from,
        date_to=date_to,
    )

    expenses = get_expense_summary(
        organization=organization,
        date_from=date_from,
        date_to=date_to,
    )

    revenue = sales["revenue"]
    paid_sales = sales["amount_paid"]
    purchase_payments = purchases["amount_paid"]
    paid_expenses = expenses["paid_amount"]

    net_cash_movement = (
        paid_sales
        - purchase_payments
        - paid_expenses
    )

    return {
        "revenue": revenue,
        "sales_collected": paid_sales,
        "supplier_payments": purchase_payments,
        "operating_expenses_paid": paid_expenses,
        "net_cash_movement": net_cash_movement,
    }


def get_dashboard_summary(
    organization,
    date_from=None,
    date_to=None,
):
    """
    Return the primary BuildOps management dashboard
    for one organization.
    """

    sales = get_sales_summary(
        organization=organization,
        date_from=date_from,
        date_to=date_to,
    )

    purchases = get_purchase_summary(
        organization=organization,
        date_from=date_from,
        date_to=date_to,
    )

    inventory = get_inventory_summary(
        organization=organization,
    )

    expenses = get_expense_summary(
        organization=organization,
        date_from=date_from,
        date_to=date_to,
    )

    financial = get_financial_summary(
        organization=organization,
        date_from=date_from,
        date_to=date_to,
    )

    return {
        "sales": sales,
        "purchases": purchases,
        "inventory": inventory,
        "expenses": expenses,
        "financial": financial,
    }


def get_top_products(
    organization,
    date_from=None,
    date_to=None,
    limit=10,
):
    """
    Return products ranked by completed-sale quantity
    within one organization.

    This is an analytical ranking, not a recommendation.
    """

    items = SaleItem.objects.filter(
        organization=organization,
        sale__organization=organization,
        sale__status__in=[
            "completed",
            "returned",
        ],
    )

    if date_from:
        items = items.filter(
            sale__sale_date__date__gte=date_from,
        )

    if date_to:
        items = items.filter(
            sale__sale_date__date__lte=date_to,
        )

    return (
        items
        .values(
            "product_id",
            "product__name",
            "product__sku",
        )
        .annotate(
            quantity_sold=Coalesce(
                Sum("quantity"),
                ZERO,
                output_field=DecimalField(
                    max_digits=14,
                    decimal_places=2,
                ),
            ),
            sales_value=Coalesce(
                Sum("line_total"),
                ZERO,
                output_field=DecimalField(
                    max_digits=14,
                    decimal_places=2,
                ),
            ),
        )
        .order_by(
            "-quantity_sold",
            "-sales_value",
        )[:limit]
    )


def get_expense_by_category(
    organization,
    date_from=None,
    date_to=None,
):
    """
    Return expense totals grouped by category
    for one organization.
    """

    expenses = Expense.objects.filter(
        organization=organization,
    )

    expenses = apply_date_range(
        expenses,
        "expense_date",
        date_from,
        date_to,
    )

    return (
        expenses
        .values(
            "category_id",
            "category__name",
        )
        .annotate(
            total_amount=Coalesce(
                Sum("amount"),
                ZERO,
                output_field=DecimalField(
                    max_digits=14,
                    decimal_places=2,
                ),
            ),
            expense_count=Count("id"),
        )
        .order_by("-total_amount")
    )