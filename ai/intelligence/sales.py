from django.db.models import Sum

from sales.models import Sale, SaleItem


def get_sales_performance(organization, date_from=None, date_to=None):
    """
    Return completed-sales performance for one organization.
    """

    sales = Sale.objects.filter(
        organization=organization,
        status="completed",
    )

    if date_from:
        sales = sales.filter(sale_date__date__gte=date_from)

    if date_to:
        sales = sales.filter(sale_date__date__lte=date_to)

    aggregates = sales.aggregate(
        total_sales=Sum("total_amount"),
        total_subtotal=Sum("subtotal"),
        total_tax=Sum("tax_amount"),
        total_discount=Sum("discount_amount"),
        total_amount_paid=Sum("amount_paid"),
    )

    return {
        "date_from": date_from,
        "date_to": date_to,
        "total_transactions": sales.count(),
        "total_sales": aggregates["total_sales"] or 0,
        "total_subtotal": aggregates["total_subtotal"] or 0,
        "total_tax": aggregates["total_tax"] or 0,
        "total_discount": aggregates["total_discount"] or 0,
        "total_amount_paid": aggregates["total_amount_paid"] or 0,
    }


def get_top_selling_products(
    organization,
    date_from=None,
    date_to=None,
    limit=10,
):
    """
    Return the top-selling products for one organization.
    """

    items = (
        SaleItem.objects.filter(
            sale__organization=organization,
            sale__status="completed",
        )
        .select_related("product", "sale")
    )

    if date_from:
        items = items.filter(sale__sale_date__date__gte=date_from)

    if date_to:
        items = items.filter(sale__sale_date__date__lte=date_to)

    return list(
        items.values(
            "product_id",
            "product__name",
            "product__sku",
        )
        .annotate(
            quantity_sold=Sum("quantity"),
            revenue=Sum("line_total"),
        )
        .order_by("-quantity_sold")[:limit]
    )