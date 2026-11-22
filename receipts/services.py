import uuid
from django.utils import timezone
from .models import Receipt


def generate_receipt_for_sale(sale_instance, user):
    existing = getattr(sale_instance, "sale_receipt", None)
    if existing is not None:
        return existing

    org = sale_instance.organization
    date_str = timezone.now().strftime("%Y%m%d")
    unique_suffix = uuid.uuid4().hex[:6].upper()
    receipt_number = f"RCP-{date_str}-{unique_suffix}"

    items = list(sale_instance.items.select_related("product").all())

    payload = {
        "store_info": {
            "name": getattr(org, "name", "BuildOps"),
            "branch": getattr(org, "city", None) or "Main Branch",
            "phone": getattr(org, "phone", "") or "",
            "currency": getattr(org, "currency", "KES") or "KES",
            "pin": getattr(org, "pin", "") or "",
        },
        "transaction": {
            "sale_id": sale_instance.id,
            "sale_number": sale_instance.sale_number,
            "receipt_number": receipt_number,
            "completed_at": timezone.now().isoformat(),
            "cashier": getattr(user, "username", "") if user else "",
            "payment_method": getattr(sale_instance, "payment_method", "cash"),
            "payment_status": getattr(sale_instance, "payment_status", "unpaid"),
        },
        "items": [
            {
                "item_name": item.product.name,
                "quantity": float(item.quantity),
                "unit_price": float(item.unit_price),
                "total_price": float(item.line_total),
            }
            for item in items
        ],
        "totals": {
            "subtotal": float(sale_instance.subtotal),
            "tax": float(sale_instance.tax_amount),
            "grand_total": float(sale_instance.total_amount),
        },
        "ai_insight": getattr(
            sale_instance,
            "ai_insight_note",
            "Thank you for shopping with BuildOps.",
        ),
    }

    return Receipt.objects.create(
        organization=org,
        transaction=sale_instance,
        receipt_number=receipt_number,
        is_printed=False,
        print_attempts=0,
        receipt_payload=payload,
    )


def revoke_receipt_for_sale(sale_instance, reason="Sale returned"):
    receipt = getattr(sale_instance, "sale_receipt", None)
    if receipt is None:
        receipt = Receipt.objects.filter(transaction=sale_instance).first()
    if receipt is None:
        return None

    if not receipt.is_revoked:
        receipt.is_revoked = True
        receipt.revoked_at = timezone.now()
        receipt.revoked_reason = reason
        receipt.save(update_fields=["is_revoked", "revoked_at", "revoked_reason"])

    return receipt