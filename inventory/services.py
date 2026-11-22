from decimal import Decimal, InvalidOperation

from django.db import transaction

from .models import InventoryItem, StockMovement


INCREASE_MOVEMENTS = {
    "purchase",
    "return_in",
    "opening",
    "transfer_in",
}

DECREASE_MOVEMENTS = {
    "sale",
    "return_out",
    "damage",
    "transfer_out",
}


@transaction.atomic
def create_stock_movement(
    *,
    organization,
    inventory_item,
    movement_type,
    quantity,
    created_by,
    purchase=None,
    sale=None,
    reference="",
    notes="",
):
    """
    Create a stock movement and update the corresponding
    inventory quantity atomically.

    For normal movement types, the movement type determines
    whether stock increases or decreases.

    For adjustments, the sign of quantity determines the
    direction:
        +5 -> increase stock by 5
        -5 -> decrease stock by 5
    """

    # ---------------------------------------------------------
    # Validate quantity
    # ---------------------------------------------------------
    try:
        quantity = Decimal(str(quantity))
    except (InvalidOperation, TypeError, ValueError):
        raise ValueError(
            "Quantity must be a valid number."
        )

    if quantity == 0:
        raise ValueError(
            "Movement quantity cannot be zero."
        )

    # ---------------------------------------------------------
    # Get and lock the inventory record
    # ---------------------------------------------------------
    inventory_item = (
        InventoryItem.objects
        .select_for_update()
        .get(
            id=inventory_item.id,
            organization=organization,
        )
    )

    current_quantity = inventory_item.quantity

    # ---------------------------------------------------------
    # Determine stock effect
    # ---------------------------------------------------------
    if movement_type == "adjustment":
        # The sign controls the direction.
        new_quantity = current_quantity + quantity

        # Store the adjustment amount exactly as entered.
        movement_quantity = quantity

    elif movement_type in INCREASE_MOVEMENTS:
        # These movements always increase stock.
        movement_quantity = abs(quantity)
        new_quantity = current_quantity + movement_quantity

    elif movement_type in DECREASE_MOVEMENTS:
        # These movements always decrease stock.
        movement_quantity = abs(quantity)
        new_quantity = current_quantity - movement_quantity

    else:
        raise ValueError(
            f"Unsupported stock movement type: {movement_type}"
        )

    # ---------------------------------------------------------
    # Prevent negative inventory
    # ---------------------------------------------------------
    if new_quantity < 0:
        raise ValueError(
            f"Insufficient stock. "
            f"Current quantity is {current_quantity}, "
            f"but this movement would result in {new_quantity}."
        )

    # ---------------------------------------------------------
    # Update inventory
    # ---------------------------------------------------------
    inventory_item.quantity = new_quantity

    inventory_item.save(
        update_fields=[
            "quantity",
            "updated_at",
        ]
    )

    # ---------------------------------------------------------
    # Record movement
    # ---------------------------------------------------------
    return StockMovement.objects.create(
        organization=organization,
        inventory_item=inventory_item,
        movement_type=movement_type,
        quantity=movement_quantity,
        purchase=purchase,
        sale=sale,
        reference=reference or "",
        notes=notes or "",
        created_by=created_by,
    )