from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
import logging

from receipts.services import generate_receipt_for_sale

from core.tenant import (
    MultipleOrganizationsError,
    NoOrganizationError,
    get_current_organization,
)

from .models import (
    Sale,
    SaleItem,
    SalePayment,
    SaleRefund,
    SaleReturn,
    SaleReturnItem,
)

from .payment_services import record_sale_payment
from .return_services import complete_sale_return
from .serializers import (
    SaleItemSerializer,
    SalePaymentSerializer,
    SaleRefundSerializer,
    SaleReturnItemSerializer,
    SaleReturnSerializer,
    SaleSerializer,
)
from .services import complete_sale

logger = logging.getLogger(__name__)


class OrganizationScopedMixin:
    permission_classes = [permissions.IsAuthenticated]

    def get_current_organization(self):
        try:
            return get_current_organization(self.request.user)
        except NoOrganizationError as exc:
            raise PermissionDenied(str(exc))
        except MultipleOrganizationsError as exc:
            raise PermissionDenied(str(exc))

    def ensure_same_organization(self, obj, organization):
        if obj.organization_id != organization.id:
            raise PermissionDenied(
                "You cannot access or use a record from another organization."
            )


class SaleViewSet(
    OrganizationScopedMixin,
    viewsets.ModelViewSet,
):
    serializer_class = SaleSerializer

    def get_queryset(self):
        organization = self.get_current_organization()

        return (
            Sale.objects
            .select_related(
                "customer",
                "created_by",
                "organization",
            )
            .prefetch_related(
                "items__product",
                "payments",
                "refunds",
                "returns__items",
            )
            .filter(
                organization=organization,
            )
        )

    def perform_create(self, serializer):
        organization = self.get_current_organization()

        customer = serializer.validated_data.get("customer")

        if customer and customer.organization_id != organization.id:
            raise PermissionDenied(
                "You cannot create a sale for a customer from another organization."
            )

        serializer.save(
            organization=organization,
            created_by=self.request.user,
        )

    def perform_update(self, serializer):
        organization = self.get_current_organization()

        sale = self.get_object()

        if sale.status != "draft":
            raise PermissionDenied(
                "Only draft sales can be edited. "
                "Completed sales are immutable; use a return workflow."
            )

        customer = serializer.validated_data.get("customer")

        if customer and customer.organization_id != organization.id:
            raise PermissionDenied(
                "You cannot assign a customer from another organization."
            )

        serializer.save()

    @action(
        detail=True,
        methods=["post"],
        url_path="complete",
    )
    def complete(self, request, pk=None):
        sale = self.get_object()

        # 1. Complete the sale using your existing domain service
        sale = complete_sale(
            sale=sale,
            user=request.user,
            organization=self.get_current_organization(),
        )

        # 2. Automatically generate and freeze the immutable digital receipt
        receipt = generate_receipt_for_sale(
            sale_instance=sale,
            user=request.user,
        )

        # 3. Serialize the completed sale response
        response_data = SaleSerializer(
            sale,
            context={"request": request},
        ).data

        # 4. Attach complete receipt info and frozen payload for the frontend modal
        response_data["receipt"] = {
            "id": receipt.id,
            "receipt_number": receipt.receipt_number,
            "is_printed": receipt.is_printed,
            "print_attempts": receipt.print_attempts,
            "last_printed_at": receipt.last_printed_at,
            "receipt_payload": receipt.receipt_payload,
        }

        return Response(
            response_data,
            status=status.HTTP_200_OK,
        )

    def destroy(self, request, *args, **kwargs):
        sale = self.get_object()

        if sale.status != "draft":
            return Response(
                {
                    "detail": (
                        "Only draft sales can be deleted."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        return super().destroy(
            request,
            *args,
            **kwargs,
        )


class SaleItemViewSet(
    OrganizationScopedMixin,
    viewsets.ModelViewSet,
):
    serializer_class = SaleItemSerializer

    def get_queryset(self):
        organization = self.get_current_organization()

        return (
            SaleItem.objects
            .select_related(
                "sale",
                "product",
                "organization",
            )
            .filter(
                organization=organization,
            )
        )

    def perform_create(self, serializer):
        organization = self.get_current_organization()

        sale = serializer.validated_data["sale"]
        product = serializer.validated_data["product"]

        self.ensure_same_organization(
            sale,
            organization,
        )

        if product.organization_id != organization.id:
            raise PermissionDenied(
                "You cannot add a product from another organization to a sale."
            )

        if sale.status != "draft":
            raise PermissionDenied(
                "Sale items can only be added to draft sales."
            )

        serializer.save(
            organization=organization,
        )

    def perform_update(self, serializer):
        organization = self.get_current_organization()

        sale_item = self.get_object()

        sale = serializer.validated_data.get(
            "sale",
            sale_item.sale,
        )

        product = serializer.validated_data.get(
            "product",
            sale_item.product,
        )

        self.ensure_same_organization(
            sale,
            organization,
        )

        if product.organization_id != organization.id:
            raise PermissionDenied(
                "You cannot use a product from another organization."
            )

        if sale.status != "draft":
            raise PermissionDenied(
                "Sale items cannot be edited after the sale is completed."
            )

        serializer.save()

    def update(self, request, *args, **kwargs):
        sale_item = self.get_object()

        if sale_item.sale.status != "draft":
            return Response(
                {
                    "detail": (
                        "Sale items cannot be edited "
                        "after the sale is completed."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        return super().update(
            request,
            *args,
            **kwargs,
        )

    def partial_update(self, request, *args, **kwargs):
        sale_item = self.get_object()

        if sale_item.sale.status != "draft":
            return Response(
                {
                    "detail": (
                        "Sale items cannot be edited "
                        "after the sale is completed."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        return super().partial_update(
            request,
            *args,
            **kwargs,
        )

    def destroy(self, request, *args, **kwargs):
        sale_item = self.get_object()

        if sale_item.sale.status != "draft":
            return Response(
                {
                    "detail": (
                        "Sale items cannot be deleted "
                        "after the sale is completed."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        return super().destroy(
            request,
            *args,
            **kwargs,
        )


class SalePaymentViewSet(
    OrganizationScopedMixin,
    viewsets.ModelViewSet,
):
    serializer_class = SalePaymentSerializer

    def get_queryset(self):
        organization = self.get_current_organization()

        return (
            SalePayment.objects
            .select_related(
                "sale",
                "received_by",
                "organization",
            )
            .filter(
                organization=organization,
            )
        )

    def create(self, request, *args, **kwargs):
        organization = self.get_current_organization()

        serializer = self.get_serializer(
            data=request.data,
        )

        serializer.is_valid(
            raise_exception=True,
        )

        sale = serializer.validated_data["sale"]

        self.ensure_same_organization(
            sale,
            organization,
        )

        payment = record_sale_payment(
            sale=sale,
            amount=serializer.validated_data["amount"],
            payment_method=serializer.validated_data[
                "payment_method"
            ],
            received_by=request.user,
            reference=serializer.validated_data.get(
                "reference",
                "",
            ),
            notes=serializer.validated_data.get(
                "notes",
                "",
            ),
            organization=organization,
        )

        output_serializer = self.get_serializer(
            payment,
        )

        return Response(
            output_serializer.data,
            status=status.HTTP_201_CREATED,
        )

    def update(self, request, *args, **kwargs):
        return Response(
            {
                "detail": (
                    "Sale payments cannot be edited "
                    "after they are recorded."
                )
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    def partial_update(self, request, *args, **kwargs):
        return Response(
            {
                "detail": (
                    "Sale payments cannot be edited "
                    "after they are recorded."
                )
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    def destroy(self, request, *args, **kwargs):
        return Response(
            {
                "detail": (
                    "Sale payments cannot be deleted. "
                    "Use the return/refund workflow instead."
                )
            },
            status=status.HTTP_400_BAD_REQUEST,
        )


class SaleRefundViewSet(
    OrganizationScopedMixin,
    viewsets.ReadOnlyModelViewSet,
):
    serializer_class = SaleRefundSerializer

    def get_queryset(self):
        organization = self.get_current_organization()

        return (
            SaleRefund.objects
            .select_related(
                "sale",
                "sale_return",
                "processed_by",
                "organization",
            )
            .filter(
                organization=organization,
            )
        )

class SaleReturnViewSet(
    OrganizationScopedMixin,
    viewsets.ModelViewSet,
):
    serializer_class = SaleReturnSerializer

    def get_queryset(self):
        organization = self.get_current_organization()

        return (
            SaleReturn.objects
            .select_related(
                "sale",
                "created_by",
                "organization",
            )
            .prefetch_related(
                "items__sale_item__product",
                "refund",
            )
            .filter(
                organization=organization,
            )
        )

    def perform_create(self, serializer):
        organization = self.get_current_organization()

        sale = serializer.validated_data["sale"]

        self.ensure_same_organization(
            sale,
            organization,
        )

        if sale.status != "completed":
            raise PermissionDenied(
                "A return can only be created for a completed sale."
            )

        if sale.payment_status != "paid":
            raise PermissionDenied(
                "A return can only be created for a fully paid sale."
            )

        serializer.save(
            organization=organization,
            created_by=self.request.user,
            status="pending",
        )

    def perform_update(self, serializer):
        organization = self.get_current_organization()
        sale_return = self.get_object()

        if (sale_return.status or "").strip().lower() != "pending":
            raise PermissionDenied(
                "Only pending returns can be edited."
            )

        sale = serializer.validated_data.get(
            "sale",
            sale_return.sale,
        )

        self.ensure_same_organization(
            sale,
            organization,
        )

        if sale.id != sale_return.sale_id:
            raise PermissionDenied(
                "The sale cannot be changed after a return is created."
            )

        if sale.status != "completed":
            raise PermissionDenied(
                "A return must belong to a completed sale."
            )

        if sale.payment_status != "paid":
            raise PermissionDenied(
                "A return can only belong to a fully paid sale."
            )

        serializer.save()

    @action(
        detail=True,
        methods=["post"],
        url_path="complete",
    )
    def complete(self, request, pk=None):
        sale_return = self.get_object()
        organization = self.get_current_organization()

        refund_method = request.data.get("refund_method")
        refund_reference = request.data.get("refund_reference", "")

        if not refund_method:
            return Response(
                {"detail": "Refund method is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        sale_return = complete_sale_return(
            sale_return=sale_return,
            user=request.user,
            organization=organization,
            refund_method=refund_method,
            refund_reference=refund_reference,
        )

        sale_return.refresh_from_db()

        # Revoke the sale's receipt once the return is completed and the sale is returned,
        # without letting a receipt lookup/field issue turn a completed return into a 500.
        if (sale_return.sale.status or "").strip().lower() == "returned":
            return_ref = (
                getattr(sale_return, "return_number", None)
                or f"RET-{sale_return.pk}"
            )
            try:
                revoke_receipt_for_sale(
                    sale_return.sale,
                    reason=f"Sale returned ({return_ref})",
                )
            except Exception:
                logger.exception(
                    "Failed to revoke receipt for sale %s on return %s",
                    sale_return.sale_id,
                    sale_return.pk,
                )

        return Response(
            SaleReturnSerializer(
                sale_return,
                context={"request": request},
            ).data,
            status=status.HTTP_200_OK,
        )

    @action(
        detail=True,
        methods=["post"],
        url_path="cancel",
    )
    def cancel(self, request, pk=None):
        sale_return = self.get_object()

        if (sale_return.status or "").strip().lower() != "pending":
            return Response(
                {"detail": "Only pending returns can be cancelled."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        sale_return.status = "cancelled"
        sale_return.save(update_fields=["status"])

        return Response(
            SaleReturnSerializer(
                sale_return,
                context={"request": request},
            ).data,
            status=status.HTTP_200_OK,
        )

class SaleReturnItemViewSet(
    OrganizationScopedMixin,
    viewsets.ModelViewSet,
):
    serializer_class = SaleReturnItemSerializer

    def get_queryset(self):
        organization = self.get_current_organization()

        return (
            SaleReturnItem.objects
            .select_related(
                "sale_return",
                "sale_item__product",
                "organization",
            )
            .filter(
                organization=organization,
            )
        )

    def perform_create(self, serializer):
        organization = self.get_current_organization()

        sale_return = serializer.validated_data[
            "sale_return"
        ]

        sale_item = serializer.validated_data[
            "sale_item"
        ]

        self.ensure_same_organization(
            sale_return,
            organization,
        )

        if sale_item.organization_id != organization.id:
            raise PermissionDenied(
                "You cannot use a sale item from another organization."
            )

        if sale_item.sale_id != sale_return.sale_id:
            raise PermissionDenied(
                "The sale item must belong to the sale being returned."
            )

        if sale_return.status != "pending":
            raise PermissionDenied(
                "Items can only be added to pending returns."
            )

        already_returned = sum(
            item.quantity
            for item in sale_item.return_items.filter(
                organization=organization,
                sale_return__status__in=[
                    "pending",
                    "completed",
                ],
            )
        )

        available_quantity = (
            sale_item.quantity - already_returned
        )

        quantity = serializer.validated_data["quantity"]

        if quantity > available_quantity:
            raise PermissionDenied(
                f"Only {available_quantity} of "
                f"{sale_item.product.name} remains available "
                "for return."
            )

        serializer.save(
            organization=organization,
        )

    def perform_update(self, serializer):
        organization = self.get_current_organization()
        sale_return_item = self.get_object()
        sale_return = sale_return_item.sale_return

        if sale_return.status != "pending":
            raise PermissionDenied(
                "Only items belonging to a pending return "
                "can be edited."
            )

        sale_item = serializer.validated_data.get(
            "sale_item",
            sale_return_item.sale_item,
        )

        if sale_item.organization_id != organization.id:
            raise PermissionDenied(
                "You cannot use a sale item from another organization."
            )

        if sale_item.sale_id != sale_return.sale_id:
            raise PermissionDenied(
                "The sale item must belong to the sale being returned."
            )

        quantity = serializer.validated_data.get(
            "quantity",
            sale_return_item.quantity,
        )

        # Exclude the current return item when calculating
        # how much quantity is already reserved.
        already_returned = sum(
            item.quantity
            for item in sale_item.return_items.filter(
                organization=organization,
                sale_return__status__in=[
                    "pending",
                    "completed",
                ],
            ).exclude(
                id=sale_return_item.id
            )
        )

        available_quantity = (
            sale_item.quantity - already_returned
        )

        if quantity > available_quantity:
            raise PermissionDenied(
                f"Only {available_quantity} of "
                f"{sale_item.product.name} remains available "
                "for return."
            )

        serializer.save()

    def destroy(self, request, *args, **kwargs):
        sale_return_item = self.get_object()
        sale_return = sale_return_item.sale_return

        if sale_return.status != "pending":
            return Response(
                {
                    "detail": (
                        "Only items belonging to a pending "
                        "return can be deleted."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        return super().destroy(
            request,
            *args,
            **kwargs,
        )