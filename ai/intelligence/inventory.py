from decimal import Decimal

from django.db.models import DecimalField, F, Sum
from django.db.models.functions import Coalesce

from inventory.models import InventoryItem


ZERO = Decimal("0.00")


def get_inventory_overview(organization):
    """
    Return high-level inventory intelligence
    for the current organization.
    """

    inventory = InventoryItem.objects.filter(
        organization=organization,
        is_active=True,
    )

    total_quantity = inventory.aggregate(
        total=Coalesce(
            Sum("quantity"),
            ZERO,
            output_field=DecimalField(
                max_digits=14,
                decimal_places=2,
            ),
        )
    )["total"]

    total_inventory_value = inventory.aggregate(
        total=Coalesce(
            Sum(
                F("quantity") * F("product__cost_price")
            ),
            ZERO,
            output_field=DecimalField(
                max_digits=14,
                decimal_places=2,
            ),
        )
    )["total"]

    return {
        "inventory_items": inventory.count(),
        "total_quantity": total_quantity,
        "total_inventory_value": total_inventory_value,
        "low_stock_items": inventory.filter(
            reorder_level__gt=0,
            quantity__lte=F("reorder_level"),
        ).count(),
        "out_of_stock_items": inventory.filter(
            quantity__lte=0
        ).count(),
    }


def get_inventory_risk(organization):
    """
    Return inventory items requiring attention
    for the current organization.
    """

    inventory = (
        InventoryItem.objects
        .filter(
            organization=organization,
            is_active=True,
        )
        .select_related("product")
    )

    results = []

    for item in inventory:
        if item.quantity <= 0:
            risk = "out_of_stock"
        elif (
            item.reorder_level > 0
            and item.quantity <= item.reorder_level
        ):
            risk = "low_stock"
        else:
            risk = "healthy"

        stock_value = (
            item.quantity
            * item.product.cost_price
        )

        results.append(
            {
                "inventory_item_id": item.id,
                "product_id": item.product_id,
                "product_name": item.product.name,
                "sku": item.product.sku,
                "quantity": item.quantity,
                "reorder_level": item.reorder_level,
                "reorder_quantity": item.reorder_quantity,
                "stock_value": stock_value,
                "risk": risk,
            }
        )

    return results