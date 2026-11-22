from django.db.models import Sum, F, DecimalField, ExpressionWrapper

from sales.models import SaleItem


def get_product_profitability(
    organization,
    date_from=None,
    date_to=None,
    limit=10,
):
    """
    Return product profitability for completed sales
    belonging to one organization.
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

    items = (
        items.values(
            "product_id",
            "product__name",
            "product__sku",
        )
        .annotate(
            quantity_sold=Sum("quantity"),
            revenue=Sum("line_total"),
            cost=Sum(
                ExpressionWrapper(
                    F("quantity") * F("product__cost_price"),
                    output_field=DecimalField(
                        max_digits=18,
                        decimal_places=2,
                    ),
                )
            ),
        )
        .annotate(
            profit=ExpressionWrapper(
                F("revenue") - F("cost"),
                output_field=DecimalField(
                    max_digits=18,
                    decimal_places=2,
                ),
            )
        )
        .order_by("-profit")
    )

    return list(items[:limit])