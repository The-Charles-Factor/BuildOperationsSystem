from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from core.tenant import (
    MultipleOrganizationsError,
    NoOrganizationError,
    get_current_organization,
)
from sales.models import Sale
from .models import Receipt
from .services import generate_receipt_for_sale


def get_request_organization(request):
    try:
        return get_current_organization(request.user)
    except (NoOrganizationError, MultipleOrganizationsError) as exc:
        raise PermissionDenied(str(exc))


def serialize_receipt(receipt: Receipt) -> dict:
    payload = receipt.receipt_payload or {}
    tx = payload.get("transaction") or {}
    return {
        "id": receipt.id,
        "receipt_number": receipt.receipt_number,
        "sale_number": tx.get("sale_number")
        or getattr(receipt.transaction, "sale_number", None),
        "is_printed": receipt.is_printed,
        "is_revoked": getattr(receipt, "is_revoked", False),
        "revoked_at": getattr(receipt, "revoked_at", None),
        "revoked_reason": getattr(receipt, "revoked_reason", ""),
        "print_attempts": receipt.print_attempts,
        "last_printed_at": receipt.last_printed_at,
        "receipt_payload": payload,
        "created_at": receipt.created_at,
    }


class ReceiptListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        organization = get_request_organization(request)

        # Backfill receipts for any completed/returned sales in this org that lack one
        completed_sales = Sale.objects.filter(
            organization=organization,
            status__in=["completed", "returned"],
            sale_receipt__isnull=True,
        )
        for sale in completed_sales:
            generate_receipt_for_sale(
                sale_instance=sale,
                user=sale.created_by or request.user,
            )

        qs = (
            Receipt.objects.select_related("transaction", "organization")
            .filter(organization=organization)
            .order_by("-created_at")
        )
        return Response([serialize_receipt(r) for r in qs])


class MarkReceiptPrintedView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, receipt_number):
        organization = get_request_organization(request)
        receipt = get_object_or_404(
            Receipt,
            receipt_number=receipt_number,
            organization=organization,
        )

        if getattr(receipt, "is_revoked", False):
            return Response(
                {"detail": "Revoked receipts cannot be printed."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        receipt.is_printed = True
        receipt.print_attempts = (receipt.print_attempts or 0) + 1
        receipt.last_printed_at = timezone.now()
        receipt.save(
            update_fields=["is_printed", "print_attempts", "last_printed_at"]
        )

        return Response(serialize_receipt(receipt), status=status.HTTP_200_OK)