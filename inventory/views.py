from rest_framework import status, viewsets
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response

from accounts.permissions import BuildOpsPermission

from .services import create_stock_movement

from core.tenant import (
    MultipleOrganizationsError,
    NoOrganizationError,
    get_current_organization,
)

from .models import InventoryItem, StockMovement

from .serializers import (
    InventoryItemSerializer,
    StockMovementSerializer,
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


class InventoryItemViewSet(
    OrganizationScopedMixin,
    viewsets.ModelViewSet,
):
    serializer_class = InventoryItemSerializer
    permission_resource = "inventory"

    def get_queryset(self):
        organization = self.get_current_organization()

        return (
            InventoryItem.objects
            .select_related("product", "organization")
            .filter(organization=organization)
        )

    def perform_create(self, serializer):
        serializer.save(
            organization=self.get_current_organization()
        )


class StockMovementViewSet(
    OrganizationScopedMixin,
    viewsets.ModelViewSet,
):
    serializer_class = StockMovementSerializer
    permission_resource = "inventory"

    def get_queryset(self):
        organization = self.get_current_organization()

        return (
            StockMovement.objects
            .select_related(
                "inventory_item",
                "inventory_item__product",
                "purchase",
                "sale",
                "created_by",
                "organization",
            )
            .filter(organization=organization)
        )

    def perform_create(self, serializer):
        organization = self.get_current_organization()

        try:
            create_stock_movement(
                organization=organization,
                inventory_item=serializer.validated_data["inventory_item"],
                movement_type=serializer.validated_data["movement_type"],
                quantity=serializer.validated_data["quantity"],
                created_by=self.request.user,
                purchase=serializer.validated_data.get("purchase"),
                sale=serializer.validated_data.get("sale"),
                reference=serializer.validated_data.get("reference", ""),
                notes=serializer.validated_data.get("notes", ""),
            )
        except ValueError as exc:
            raise ValidationError({"quantity": str(exc)})