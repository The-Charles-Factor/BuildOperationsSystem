from rest_framework import (
    permissions,
    status,
    viewsets,
)
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response

from core.tenant import (
    MultipleOrganizationsError,
    NoOrganizationError,
    get_current_organization,
)

from .serializers import (
    DashboardReportSerializer,
    DateRangeSerializer,
    ExpenseCategoryReportSerializer,
    TopProductSerializer,
)
from .services import (
    get_dashboard_summary,
    get_expense_by_category,
    get_top_products,
)


class ReportsViewSet(viewsets.ViewSet):
    """
    Read-only reporting API.

    All reports are calculated dynamically from operational
    data and are strictly scoped to the authenticated
    user's current organization.
    """

    permission_classes = [
        permissions.IsAuthenticated
    ]

    def get_current_organization(self):
        try:
            return get_current_organization(
                self.request.user
            )
        except NoOrganizationError as exc:
            raise PermissionDenied(str(exc))
        except MultipleOrganizationsError as exc:
            raise PermissionDenied(str(exc))

    def get_date_range(self):
        serializer = DateRangeSerializer(
            data=self.request.query_params
        )

        serializer.is_valid(
            raise_exception=True
        )

        return (
            serializer.validated_data.get("date_from"),
            serializer.validated_data.get("date_to"),
        )

    def dashboard(self, request):
        organization = self.get_current_organization()

        date_from, date_to = self.get_date_range()

        report = get_dashboard_summary(
            organization=organization,
            date_from=date_from,
            date_to=date_to,
        )

        serializer = DashboardReportSerializer(
            report
        )

        return Response(
            serializer.data,
            status=status.HTTP_200_OK,
        )

    def top_products(self, request):
        organization = self.get_current_organization()

        date_from, date_to = self.get_date_range()

        limit = request.query_params.get(
            "limit",
            "10",
        )

        try:
            limit = int(limit)
        except (TypeError, ValueError):
            return Response(
                {
                    "limit": (
                        "Limit must be a positive integer."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        if limit <= 0 or limit > 100:
            return Response(
                {
                    "limit": (
                        "Limit must be between "
                        "1 and 100."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        report = get_top_products(
            organization=organization,
            date_from=date_from,
            date_to=date_to,
            limit=limit,
        )

        serializer = TopProductSerializer(
            report,
            many=True,
        )

        return Response(
            serializer.data,
            status=status.HTTP_200_OK,
        )

    def expenses_by_category(self, request):
        organization = self.get_current_organization()

        date_from, date_to = self.get_date_range()

        report = get_expense_by_category(
            organization=organization,
            date_from=date_from,
            date_to=date_to,
        )

        serializer = ExpenseCategoryReportSerializer(
            report,
            many=True,
        )

        return Response(
            serializer.data,
            status=status.HTTP_200_OK,
        )