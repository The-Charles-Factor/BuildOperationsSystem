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

from .models import Expense, ExpenseCategory
from .serializers import (
    ExpenseCategorySerializer,
    ExpenseSerializer,
)
from .workflow_services import (
    approve_expense,
    cancel_expense,
    pay_expense,
)


class OrganizationScopedMixin:
    """
    Provides the current organization for authenticated users.

    All organization-scoped expense viewsets use this mixin to
    guarantee tenant isolation.
    """

    permission_classes = [BuildOpsPermission]

    def get_current_organization(self):
        try:
            return get_current_organization(
                self.request.user
            )
        except NoOrganizationError as exc:
            raise PermissionDenied(str(exc))
        except MultipleOrganizationsError as exc:
            raise PermissionDenied(str(exc))


class ExpenseCategoryViewSet(
    OrganizationScopedMixin,
    viewsets.ModelViewSet,
):
    serializer_class = ExpenseCategorySerializer
    permission_resource = "expenses"

    def get_queryset(self):
        organization = self.get_current_organization()

        return (
            ExpenseCategory.objects
            .filter(
                organization=organization
            )
            .order_by("name")
        )

    def perform_create(self, serializer):
        organization = self.get_current_organization()

        serializer.save(
            organization=organization
        )

    def perform_update(self, serializer):
        organization = self.get_current_organization()
        category = self.get_object()

        if category.organization_id != organization.id:
            raise PermissionDenied(
                "You cannot modify a category "
                "from another organization."
            )

        serializer.save(
            organization=organization
        )


class ExpenseViewSet(
    OrganizationScopedMixin,
    viewsets.ModelViewSet,
):
    serializer_class = ExpenseSerializer
    permission_resource = "expenses"

    def get_queryset(self):
        organization = self.get_current_organization()

        return (
            Expense.objects
            .select_related(
                "category",
                "created_by",
                "approved_by",
                "organization",
            )
            .filter(
                organization=organization
            )
            .order_by("-created_at")
        )

    def perform_create(self, serializer):
        organization = self.get_current_organization()

        category = serializer.validated_data.get(
            "category"
        )

        if category is None:
            raise PermissionDenied(
                "An expense category is required."
            )

        if category.organization_id != organization.id:
            raise PermissionDenied(
                "You cannot create an expense using "
                "a category from another organization."
            )

        if not category.is_active:
            raise PermissionDenied(
                "You cannot create an expense using "
                "an inactive category."
            )

        serializer.save(
            organization=organization,
            created_by=self.request.user,
        )

    def perform_update(self, serializer):
        organization = self.get_current_organization()
        expense = self.get_object()

        if expense.organization_id != organization.id:
            raise PermissionDenied(
                "You cannot modify an expense "
                "from another organization."
            )

        category = serializer.validated_data.get(
            "category",
            expense.category,
        )

        if category.organization_id != organization.id:
            raise PermissionDenied(
                "You cannot use an expense category "
                "from another organization."
            )

        if not category.is_active:
            raise PermissionDenied(
                "You cannot use an inactive expense category."
            )

        serializer.save(
            organization=organization
        )

    def update(self, request, *args, **kwargs):
        expense = self.get_object()

        if expense.status != "pending":
            return Response(
                {
                    "detail": (
                        "Only pending expenses can be edited."
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
        url_path="approve",
    )
    def approve(
        self,
        request,
        pk=None,
    ):
        expense = self.get_object()

        expense = approve_expense(
            expense=expense,
            approved_by=request.user,
        )

        return Response(
            ExpenseSerializer(
                expense,
                context={"request": request},
            ).data
        )

    @action(
        detail=True,    
        methods=["post"],
        url_path="pay",
    )
    def pay(
        self,
        request,
        pk=None,
    ):
        expense = self.get_object()

        payment_method = request.data.get(
            "payment_method"
        )

        expense = pay_expense(
            expense=expense,
            payment_method=payment_method,
            paid_by=request.user,
        )

        return Response(
            ExpenseSerializer(
                expense,
                context={"request": request},
            ).data
        )

    @action(
        detail=True,
        methods=["post"],
        url_path="cancel",
    )
    def cancel(
        self,
        request,
        pk=None,
    ):
        expense = self.get_object()

        expense = cancel_expense(
            expense=expense,
            cancelled_by=request.user,
        )

        return Response(
            ExpenseSerializer(
                expense,
                context={"request": request},
            ).data
        )