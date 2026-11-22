from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from core.models import Organization
from .models import Receipt


def get_request_organization(request):
    org = getattr(request, "organization", None)
    if org:
        return org
    profile = getattr(request.user, "profile", None)
    if profile and getattr(profile, "organization", None):
        return profile.organization
    return Organization.objects.first()


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
        qs = Receipt.objects.select_related("transaction", "organization").order_by(
            "-created_at"
        )
        if organization is not None:
            qs = qs.filter(organization=organization)
        return Response([serialize_receipt(r) for r in qs])


class MarkReceiptPrintedView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, receipt_number):
        organization = get_request_organization(request)
        filters = {"receipt_number": receipt_number}
        if organization is not None:
            filters["organization"] = organization

        receipt = get_object_or_404(Receipt, **filters)

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