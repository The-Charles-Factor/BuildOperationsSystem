from decimal import Decimal

from django.db.models import Sum

from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response

from accounts.permissions import BuildOpsPermission

from core.tenant import (
    MultipleOrganizationsError,
    NoOrganizationError,
    get_current_organization,
)

from sales.models import Sale

from .models import Customer, CustomerAddress
from .serializers import (
    CustomerAddressSerializer,
    CustomerSerializer,
    CustomerPurchaseSummarySerializer,
    CustomerSaleHistorySerializer,
)


class OrganizationScopedMixin:
    permission_classes = [BuildOpsPermission]

    def get_current_organization(self):
        try:
            return get_current_organization(self.request.user)
        except NoOrganizationError as exc:
            raise PermissionDenied(str(exc))
        except MultipleOrganizationsError as exc:
            raise PermissionDenied(str(exc))


class CustomerViewSet(
    OrganizationScopedMixin,
    viewsets.ModelViewSet,
):
    serializer_class = CustomerSerializer
    permission_resource = "customers"

    def get_queryset(self):
        organization = self.get_current_organization()

        return Customer.objects.filter(
            organization=organization
        ).prefetch_related("addresses")

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

        customer = (
            Customer.objects
            .filter(
                pk=pk,
                organization=organization,
            )
            .first()
        )

        if customer is None:
            raise PermissionDenied(
                "You cannot access this customer."
            )

        sales = (
            Sale.objects
            .filter(
                organization=organization,
                customer=customer,
            )
            .select_related(
                "customer",
                "created_by",
            )
            .prefetch_related(
                "refunds",
            )
            .order_by("-sale_date")
        )

        completed_sales = sales.filter(
            status__in=["completed", "returned"]
        )

        totals = completed_sales.aggregate(
            total_spent=Sum("total_amount"),
            total_discount=Sum("discount_amount"),
            total_paid=Sum("amount_paid"),
        )

        total_spent = (
            totals["total_spent"]
            or Decimal("0.00")
        )

        total_discount = (
            totals["total_discount"]
            or Decimal("0.00")
        )

        total_paid = (
            totals["total_paid"]
            or Decimal("0.00")
        )

        total_refunded = sum(
            (
                refund.amount
                for sale in completed_sales
                for refund in sale.refunds.all()
            ),
            Decimal("0.00"),
        )

        net_spent = total_spent - total_refunded

        outstanding = max(
            Decimal("0.00"),
            total_spent - total_paid,
        )

        last_purchase = (
            completed_sales
            .order_by("-sale_date")
            .first()
        )

        summary = {
            "total_sales": completed_sales.count(),
            "total_spent": total_spent,
            "total_discount": total_discount,
            "total_paid": total_paid,
            "total_refunded": total_refunded,
            "net_spent": net_spent,
            "outstanding": outstanding,
            "last_purchase_date": (
                last_purchase.sale_date
                if last_purchase
                else None
            ),
        }

        return Response({
            "customer": customer.id,
            "summary": CustomerPurchaseSummarySerializer(
                summary
            ).data,
            "sales": CustomerSaleHistorySerializer(
                sales,
                many=True,
            ).data,
        })


class CustomerAddressViewSet(
    OrganizationScopedMixin,
    viewsets.ModelViewSet,
):
    serializer_class = CustomerAddressSerializer
    permission_resource = "customers"

    def get_queryset(self):
        organization = self.get_current_organization()

        return CustomerAddress.objects.filter(
            customer__organization=organization
        ).select_related("customer")

    def perform_create(self, serializer):
        organization = self.get_current_organization()
        customer = serializer.validated_data["customer"]

        if customer.organization_id != organization.id:
            raise PermissionDenied(
                "You cannot create an address for a customer "
                "from another organization."
            )

        serializer.save()