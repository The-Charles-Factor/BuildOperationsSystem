from decimal import Decimal

from django.db import transaction
from rest_framework.exceptions import ValidationError

from core.services import create_audit_log
from inventory.models import InventoryItem, StockMovement

from .models import Purchase


@transaction.atomic
def receive_purchase(
    *,
    purchase,
    received_items,
    received_by,
    organization,
):
    if purchase.organization_id != organization.id:
        raise ValidationError(
            "You cannot receive a purchase from another organization."
        )

    purchase = (
        Purchase.objects
        .select_for_update()
        .prefetch_related(
            "items__product",
        )
        .get(
            pk=purchase.pk,
            organization=organization,
        )
    )

    if purchase.status == "cancelled":
        raise ValidationError(
            "Cannot receive a cancelled purchase."
        )

    if purchase.status == "draft":
        raise ValidationError(
            "A purchase must be ordered before it can be received."
        )

    if purchase.status == "received":
        raise ValidationError(
            "This purchase has already been fully received."
        )

    if not received_items:
        raise ValidationError(
            "At least one purchase item must be received."
        )

    purchase_items = {
        item.id: item
        for item in purchase.items.filter(
            organization=organization,
        )
    }

    processed_item_ids = set()
    total_received = Decimal("0.00")

    for received_item in received_items:
        purchase_item_id = received_item["purchase_item_id"]

        receive_quantity = Decimal(
            received_item["quantity"]
        )

        if purchase_item_id in processed_item_ids:
            raise ValidationError(
                f"Purchase item {purchase_item_id} "
                "was supplied more than once."
            )

        processed_item_ids.add(purchase_item_id)

        purchase_item = purchase_items.get(
            purchase_item_id
        )

        if purchase_item is None:
            raise ValidationError(
                f"Purchase item {purchase_item_id} "
                "does not belong to this purchase "
                "or organization."
            )

        if purchase_item.organization_id != organization.id:
            raise ValidationError(
                "The purchase item belongs to another organization."
            )

        if purchase_item.product.organization_id != organization.id:
            raise ValidationError(
                "The product belongs to another organization."
            )

        if receive_quantity <= Decimal("0.00"):
            raise ValidationError(
                "Received quantity must be greater than zero."
            )

        outstanding_quantity = (
            purchase_item.quantity
            - purchase_item.received_quantity
        )

        if receive_quantity > outstanding_quantity:
            raise ValidationError(
                f"Cannot receive {receive_quantity} units of "
                f"{purchase_item.product.name}. "
                f"Outstanding quantity is "
                f"{outstanding_quantity}."
            )

        inventory_item, _ = (
            InventoryItem.objects
            .select_for_update()
            .get_or_create(
                organization=organization,
                product=purchase_item.product,
                defaults={
                    "quantity": Decimal("0.00"),
                    "reorder_level": Decimal("0.00"),
                    "reorder_quantity": Decimal("0.00"),
                    "location": "Main Store",
                    "is_active": True,
                },
            )
        )

        if inventory_item.organization_id != organization.id:
            raise ValidationError(
                "The inventory item belongs to another organization."
            )

        inventory_item.quantity += receive_quantity

        inventory_item.save(
            update_fields=[
                "quantity",
                "updated_at",
            ]
        )

        purchase_item.received_quantity += receive_quantity

        purchase_item.save(
            update_fields=[
                "received_quantity",
            ]
        )

        StockMovement.objects.create(
            organization=organization,
            inventory_item=inventory_item,
            purchase=purchase,
            movement_type="purchase",
            quantity=receive_quantity,
            reference=purchase.purchase_number,
            notes=(
                f"Stock received for purchase "
                f"{purchase.purchase_number}."
            ),
            created_by=received_by,
        )

        total_received += receive_quantity

    all_received = all(
        item.received_quantity >= item.quantity
        for item in purchase.items.filter(
            organization=organization,
        )
    )

    any_received = any(
        item.received_quantity > Decimal("0.00")
        for item in purchase.items.filter(
            organization=organization,
        )
    )

    if all_received:
        purchase.status = "received"
    elif any_received:
        purchase.status = "partially_received"

    purchase.save(
        update_fields=[
            "status",
            "updated_at",
        ]
    )

    create_audit_log(
        user=received_by,
        organization=organization,
        action="receive",
        model_name="Purchase",
        object_id=purchase.id,
        description=(
            f"Purchase {purchase.purchase_number} received "
            f"{total_received} unit(s). "
            f"Status: {purchase.status}."
        ),
    )

    return purchase