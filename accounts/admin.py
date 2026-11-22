from django.contrib import admin

from .models import UserProfile


@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    list_display = (
        "user",
        "phone",
        "employee_id",
        "department",
        "active_organization",
        "created_at",
    )

    list_filter = (
        "department",
        "active_organization",
    )

    search_fields = (
        "user__username",
        "user__first_name",
        "user__last_name",
        "user__email",
        "phone",
        "employee_id",
    )

    readonly_fields = (
        "created_at",
        "updated_at",
    )