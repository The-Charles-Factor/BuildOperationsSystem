"""
URL configuration for buildops project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.2/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""

from django.contrib import admin
from django.urls import include, path

from rest_framework.authtoken import views as auth_views

urlpatterns = [
    path("admin/", admin.site.urls),

    path(
        "api-token-auth/",
        auth_views.obtain_auth_token,
        name="api-token-auth",
    ),

    path("api/accounts/", include("accounts.urls")),
    path("api/", include("products.urls")),
    path("api/", include("suppliers.urls")),
    path("api/", include("customers.urls")),
    path("api/", include("expenses.urls")),
    path("api/", include("purchases.urls")),
    path("api/", include("sales.urls")),
    path("api/", include("inventory.urls")),
    path("api/receipts/", include("receipts.urls")),
    path("api/", include("core.urls")),

    path("api/reports/", include("reports.urls")),
    path("api/ai/", include("ai.urls")),
]
