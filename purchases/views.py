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

from .models import Purchase, PurchaseItem
from .payment_services import make_purchase_payment
from .receiving_services import receive_purchase
from .serializers import (
    PurchaseItemSerializer,
    PurchasePaymentSerializer,
    PurchaseReceivingSerializer,
    PurchaseSerializer,
)
from .workflow_services import (
    cancel_purchase,
    order_purchase,
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

    def ensure_same_organization(self, obj, organization):
        if obj.organization_id != organization.id:
            raise PermissionDenied(
                "You cannot access or use a record from another organization."
            )


class PurchaseViewSet(
    OrganizationScopedMixin,
    viewsets.ModelViewSet,
):
    serializer_class = PurchaseSerializer
    permission_resource = "purchases"

    def get_permissions(self):
        if self.action == "pay":
            self.permission_action = "payment"

        return super().get_permissions()

    def get_queryset(self):
        organization = self.get_current_organization()

        return (
            Purchase.objects
            .select_related(
                "supplier",
                "created_by",
                "organization",
            )
            .prefetch_related(
                "items__product",
                "payments",
            )
            .filter(organization=organization)
        )

    def perform_create(self, serializer):
        organization = self.get_current_organization()
        supplier = serializer.validated_data.get("supplier")

        if supplier is None:
            raise PermissionDenied(
                "A supplier is required."
            )

        if supplier.organization_id != organization.id:
            raise PermissionDenied(
                "You cannot create a purchase using a supplier "
                "from another organization."
            )

        serializer.save(
            organization=organization,
            created_by=self.request.user,
        )

    def perform_update(self, serializer):
        organization = self.get_current_organization()
        purchase = self.get_object()

        self.ensure_same_organization(
            purchase,
            organization,
        )

        supplier = serializer.validated_data.get(
            "supplier",
            purchase.supplier,
        )

        if supplier.organization_id != organization.id:
            raise PermissionDenied(
                "You cannot use a supplier from another organization."
            )

        serializer.save(
            organization=organization,
        )

    def update(self, request, *args, **kwargs):
        purchase = self.get_object()

        if purchase.status != "draft":
            return Response(
                {
                    "detail": (
                        "Only draft purchases can be edited. "
                        "Use the purchase workflow actions for "
                        "ordered, receiving, payment, or cancellation."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        return super().update(
            request,
            *args,
            **kwargs,
        )

    @action(
        detail=True,
        methods=["post"],
        url_path="order",
    )
    def order(self, request, pk=None):
        organization = self.get_current_organization()
        purchase = self.get_object()

        self.ensure_same_organization(
            purchase,
            organization,
        )

        purchase = order_purchase(
            purchase=purchase,
            user=request.user,
            organization=organization,
        )

        return Response(
            PurchaseSerializer(
                purchase,
                context={"request": request},
            ).data
        )

    @action(
        detail=True,
        methods=["post"],
        url_path="cancel",
    )
    def cancel(self, request, pk=None):
        organization = self.get_current_organization()
        purchase = self.get_object()

        self.ensure_same_organization(
            purchase,
            organization,
        )

        purchase = cancel_purchase(
            purchase=purchase,
            user=request.user,
            organization=organization,
        )

        return Response(
            PurchaseSerializer(
                purchase,
                context={"request": request},
            ).data
        )

    @action(
        detail=True,
        methods=["post"],
        url_path="receive",
    )
    def receive(self, request, pk=None):
        organization = self.get_current_organization()
        purchase = self.get_object()

        self.ensure_same_organization(
            purchase,
            organization,
        )

        serializer = PurchaseReceivingSerializer(
            data=request.data,
            context={"request": request},
        )

        serializer.is_valid(
            raise_exception=True,
        )

        purchase = receive_purchase(
            purchase=purchase,
            received_items=serializer.validated_data["items"],
            received_by=request.user,
            organization=organization,
        )

        return Response(
            PurchaseSerializer(
                purchase,
                context={"request": request},
            ).data,
            status=status.HTTP_200_OK,
        )

    @action(
        detail=True,
        methods=["post"],
        url_path="pay",
    )
    def pay(self, request, pk=None):
        organization = self.get_current_organization()
        purchase = self.get_object()

        self.ensure_same_organization(
            purchase,
            organization,
        )

        serializer = PurchasePaymentSerializer(
            data=request.data,
            context={"request": request},
        )

        serializer.is_valid(
            raise_exception=True,
        )

        payment = make_purchase_payment(
            purchase=purchase,
            amount=serializer.validated_data["amount"],
            payment_method=serializer.validated_data["payment_method"],
            paid_by=request.user,
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

        return Response(
            PurchasePaymentSerializer(
                payment,
                context={"request": request},
            ).data,
            status=status.HTTP_201_CREATED,
        )


class PurchaseItemViewSet(
    OrganizationScopedMixin,
    viewsets.ReadOnlyModelViewSet,
):
    serializer_class = PurchaseItemSerializer
    permission_resource = "purchases"

    def get_queryset(self):
        organization = self.get_current_organization()

        return (
            PurchaseItem.objects
            .select_related(
                "purchase",
                "product",
                "organization",
            )
            .filter(organization=organization)
        )