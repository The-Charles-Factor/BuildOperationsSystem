from rest_framework import filters, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from core.tenant import (
    MultipleOrganizationsError,
    NoOrganizationError,
    get_current_organization,
)

from accounts.permissions import BuildOpsPermission

from .models import Brand, Category, Product
from .serializers import (
    BrandSerializer,
    CategorySerializer,
    ProductSerializer,
)


class OrganizationScopedMixin:
    """
    Restrict a viewset to the authenticated user's organization.
    """

    permission_classes = [BuildOpsPermission]

    def get_current_organization(self):
        try:
            return get_current_organization(
                self.request.user
            )

        except NoOrganizationError as exc:
            from rest_framework.exceptions import PermissionDenied

            raise PermissionDenied(str(exc))

        except MultipleOrganizationsError as exc:
            from rest_framework.exceptions import PermissionDenied

            raise PermissionDenied(str(exc))


class CategoryViewSet(
    OrganizationScopedMixin,
    viewsets.ModelViewSet,
):
    permission_resource = "products"

    serializer_class = CategorySerializer

    filter_backends = [
        filters.SearchFilter,
        filters.OrderingFilter,
    ]

    search_fields = [
        "name",
        "description",
    ]

    ordering_fields = [
        "name",
        "created_at",
        "updated_at",
    ]

    ordering = ["name"]

    def get_queryset(self):
        organization = self.get_current_organization()

        return Category.objects.filter(
            organization=organization
        )

    def perform_create(self, serializer):
        serializer.save(
            organization=self.get_current_organization()
        )


class BrandViewSet(
    OrganizationScopedMixin,
    viewsets.ModelViewSet,
):
    permission_resource = "products"

    serializer_class = BrandSerializer

    filter_backends = [
        filters.SearchFilter,
        filters.OrderingFilter,
    ]

    search_fields = [
        "name",
        "description",
    ]

    ordering_fields = [
        "name",
        "created_at",
        "updated_at",
    ]

    ordering = ["name"]

    def get_queryset(self):
        organization = self.get_current_organization()

        return Brand.objects.filter(
            organization=organization
        )

    def perform_create(self, serializer):
        serializer.save(
            organization=self.get_current_organization()
        )


class ProductViewSet(
    OrganizationScopedMixin,
    viewsets.ModelViewSet,
):
    permission_resource = "products"

    serializer_class = ProductSerializer

    filter_backends = [
        filters.SearchFilter,
        filters.OrderingFilter,
    ]

    search_fields = [
        "sku",
        "name",
        "description",
    ]

    ordering_fields = [
        "name",
        "sku",
        "cost_price",
        "selling_price",
        "tax_rate",
        "created_at",
        "updated_at",
    ]

    ordering = ["name"]

    def get_queryset(self):
        organization = self.get_current_organization()

        queryset = (
            Product.objects
            .select_related(
                "category",
                "brand",
            )
            .filter(
                organization=organization
            )
        )

        is_active = self.request.query_params.get(
            "is_active"
        )

        category = self.request.query_params.get(
            "category"
        )

        brand = self.request.query_params.get(
            "brand"
        )

        if is_active is not None:
            if is_active.lower() in ["true", "1"]:
                queryset = queryset.filter(
                    is_active=True
                )

            elif is_active.lower() in ["false", "0"]:
                queryset = queryset.filter(
                    is_active=False
                )

        if category:
            queryset = queryset.filter(
                category_id=category
            )

        if brand:
            queryset = queryset.filter(
                brand_id=brand
            )

        return queryset

    def perform_create(self, serializer):
        serializer.save(
            organization=self.get_current_organization()
        )

    @action(
        detail=True,
        methods=["post"],
        url_path="activate",
    )
    def activate(
        self,
        request,
        pk=None,
    ):
        product = self.get_object()

        if product.is_active:
            return Response(
                {
                    "detail": "Product is already active."
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        product.is_active = True

        product.save(
            update_fields=[
                "is_active",
                "updated_at",
            ]
        )

        return Response(
            ProductSerializer(product).data,
            status=status.HTTP_200_OK,
        )

    @action(
        detail=True,
        methods=["post"],
        url_path="deactivate",
    )
    def deactivate(
        self,
        request,
        pk=None,
    ):
        product = self.get_object()

        if not product.is_active:
            return Response(
                {
                    "detail": "Product is already inactive."
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        product.is_active = False

        product.save(
            update_fields=[
                "is_active",
                "updated_at",
            ]
        )

        return Response(
            ProductSerializer(product).data,
            status=status.HTTP_200_OK,
        )

    def destroy(
        self,
        request,
        *args,
        **kwargs,
    ):
        product = self.get_object()

        return Response(
            {
                "detail": (
                    "Products are not deleted through the API. "
                    "Deactivate the product instead so historical "
                    "sales and purchase records remain intact."
                )
            },
            status=status.HTTP_400_BAD_REQUEST,
        )