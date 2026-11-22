from django.db import transaction
from rest_framework.exceptions import ValidationError

from core.services import create_audit_log

from .models import Purchase


@transaction.atomic
def order_purchase(*, purchase, user, organization):
    if purchase.organization_id != organization.id:
        raise ValidationError(
            "You cannot order a purchase from another organization."
        )

    purchase = (
        Purchase.objects
        .select_for_update()
        .get(
            pk=purchase.pk,
            organization=organization,
        )
    )

    if purchase.status != "draft":
        raise ValidationError(
            "Only draft purchases can be ordered."
        )

    if not purchase.items.filter(
        organization=organization,
    ).exists():
        raise ValidationError(
            "A purchase must contain at least one item."
        )

    purchase.status = "ordered"

    purchase.save(
        update_fields=[
            "status",
            "updated_at",
        ]
    )

    create_audit_log(
        user=user,
        organization=organization,
        action="order",
        model_name="Purchase",
        object_id=purchase.id,
        description=(
            f"Purchase {purchase.purchase_number} ordered."
        ),
    )

    return purchase


@transaction.atomic
def cancel_purchase(*, purchase, user, organization):
    if purchase.organization_id != organization.id:
        raise ValidationError(
            "You cannot cancel a purchase from another organization."
        )

    purchase = (
        Purchase.objects
        .select_for_update()
        .get(
            pk=purchase.pk,
            organization=organization,
        )
    )

    if purchase.status == "cancelled":
        raise ValidationError(
            "This purchase is already cancelled."
        )

    if purchase.status in [
        "partially_received",
        "received",
    ]:
        raise ValidationError(
            "A purchase with received stock cannot be cancelled."
        )

    purchase.status = "cancelled"

    purchase.save(
        update_fields=[
            "status",
            "updated_at",
        ]
    )

    create_audit_log(
        user=user,
        organization=organization,
        action="cancel",
        model_name="Purchase",
        object_id=purchase.id,
        description=(
            f"Purchase {purchase.purchase_number} cancelled."
        ),
    )

    return purchase 