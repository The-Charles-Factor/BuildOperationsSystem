from django.urls import path

from .views import ReportsViewSet


urlpatterns = [
    path(
        "dashboard/",
        ReportsViewSet.as_view(
            {
                "get": "dashboard",
            }
        ),
        name="reports-dashboard",
    ),

    path(
        "top-products/",
        ReportsViewSet.as_view(
            {
                "get": "top_products",
            }
        ),
        name="reports-top-products",
    ),

    path(
        "expenses-by-category/",
        ReportsViewSet.as_view(
            {
                "get": "expenses_by_category",
            }
        ),
        name="reports-expenses-by-category",
    ),
]