from django.db import transaction
from rest_framework.exceptions import ValidationError

from core.services import create_audit_log
from inventory.models import InventoryItem, StockMovement


@transaction.atomic
def complete_sale(*, sale, user, organization):
    """
    Complete a sale and deduct its products from inventory.

    The entire operation runs inside one database transaction.
    If any item cannot be fulfilled, nothing is changed.
    """

    if sale.organization_id != organization.id:
        raise ValidationError(
            "You cannot complete a sale from another organization."
        )

    if sale.status != "draft":
        raise ValidationError(
            "Only draft sales can be completed."
        )

    items = list(
        sale.items
        .select_related("product")
        .filter(organization=organization)
    )

    if not items:
        raise ValidationError(
            "A sale must contain at least one item."
        )

    product_ids = [
        item.product_id
        for item in items
    ]

    inventory_items = (
        InventoryItem.objects
        .select_for_update()
        .select_related("product")
        .filter(
            organization=organization,
            product_id__in=product_ids,
            is_active=True,
        )
    )

    inventory_by_product = {
        item.product_id: item
        for item in inventory_items
    }

    # Validate that every sale item belongs to this organization.
    for sale_item in items:
        if sale_item.organization_id != organization.id:
            raise ValidationError(
                "A sale item belongs to another organization."
            )

        if sale_item.product.organization_id != organization.id:
            raise ValidationError(
                f"Product {sale_item.product.name} belongs "
                "to another organization."
            )

    # Validate all stock before changing anything.
    for sale_item in items:
        inventory_item = inventory_by_product.get(
            sale_item.product_id
        )

        if inventory_item is None:
            raise ValidationError(
                f"No active inventory record exists for "
                f"{sale_item.product.name}."
            )

        if inventory_item.organization_id != organization.id:
            raise ValidationError(
                f"Inventory for {sale_item.product.name} "
                "belongs to another organization."
            )

        if inventory_item.quantity < sale_item.quantity:
            raise ValidationError(
                f"Insufficient stock for "
                f"{sale_item.product.name}. "
                f"Available: {inventory_item.quantity}, "
                f"Required: {sale_item.quantity}."
            )

    # Stock is sufficient for every item.
    # Now perform the actual deduction.
    for sale_item in items:
        inventory_item = inventory_by_product[
            sale_item.product_id
        ]

        inventory_item.quantity -= sale_item.quantity

        inventory_item.save(
            update_fields=[
                "quantity",
                "updated_at",
            ]
        )

        StockMovement.objects.create(
            organization=organization,
            inventory_item=inventory_item,
            sale=sale,
            movement_type="sale",
            quantity=sale_item.quantity,
            reference=sale.sale_number,
            notes=(
                f"Stock issued for sale "
                f"{sale.sale_number}."
            ),
            created_by=user,
        )

    sale.status = "completed"

    sale.save(
        update_fields=[
            "status",
            "updated_at",
        ]
    )

    create_audit_log(
        user=user,
        organization=organization,
        action="complete",
        model_name="Sale",
        object_id=sale.id,
        description=(
            f"Sale {sale.sale_number} completed. "
            f"Inventory issued for {len(items)} item(s)."
        ),
    )

    return sale