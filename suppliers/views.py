from decimal import Decimal

from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response

from accounts.permissions import BuildOpsPermission
from core.tenant import (
    MultipleOrganizationsError,
    NoOrganizationError,
    get_current_organization,
)
from purchases.models import Purchase

from .models import Supplier
from .serializers import (
    SupplierPurchaseHistorySerializer,
    SupplierPurchaseSummarySerializer,
    SupplierSerializer,
)


class SupplierViewSet(viewsets.ModelViewSet):
    serializer_class = SupplierSerializer
    permission_classes = [BuildOpsPermission]
    permission_resource = "suppliers"

    def get_current_organization(self):
        try:
            return get_current_organization(self.request.user)
        except NoOrganizationError as exc:
            raise PermissionDenied(str(exc))
        except MultipleOrganizationsError as exc:
            raise PermissionDenied(str(exc))

    def get_queryset(self):
        organization = self.get_current_organization()

        return (
            Supplier.objects
            .filter(organization=organization)
        )

    def perform_create(self, serializer):
        serializer.save(
            organization=self.get_current_organization()
        )

    @action(
        detail=True,
        methods=["get"],
        url_path="purchase-history",
    )
    def purchase_history(self, request, pk=None):
        organization = self.get_current_organization()

        supplier = (
            self.get_queryset()
            .filter(
                pk=pk,
                organization=organization,
            )
            .first()
        )

        if supplier is None:
            raise PermissionDenied(
                "You cannot access this supplier."
            )

        purchases = (
            Purchase.objects
            .filter(
                organization=organization,
                supplier=supplier,
                status__in=[
                    "ordered",
                    "partially_received",
                    "received",
                ],
            )
            .select_related(
                "supplier",
                "created_by",
            )
            .prefetch_related(
                "payments",
                "items__product",
            )
            .order_by("-purchase_date")
        )

        total_purchases = purchases.count()

        total_purchase_value = sum(
            (
                purchase.total_amount
                for purchase in purchases
            ),
            Decimal("0.00"),
        )

        total_paid = sum(
            (
                payment.amount
                for purchase in purchases
                for payment in purchase.payments.all()
            ),
            Decimal("0.00"),
        )

        outstanding = max(
            Decimal("0.00"),
            total_purchase_value - total_paid,
        )

        last_purchase = purchases.first()

        summary = {
            "total_purchases": total_purchases,
            "total_purchase_value": total_purchase_value,
            "total_paid": total_paid,
            "outstanding": outstanding,
            "last_purchase_date": (
                last_purchase.purchase_date
                if last_purchase
                else None
            ),
        }

        return Response(
            {
                "supplier": supplier.id,
                "summary": SupplierPurchaseSummarySerializer(
                    summary
                ).data,
                "purchases": SupplierPurchaseHistorySerializer(
                    purchases,
                    many=True,
                    context={"request": request},
                ).data,
            }
        )