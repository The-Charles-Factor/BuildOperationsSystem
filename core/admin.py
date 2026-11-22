from django.contrib import admin

from .models import (
    AuditLog,
    Organization,
    OrganizationMembership,
)


@admin.register(Organization)
class OrganizationAdmin(admin.ModelAdmin):
    list_display = (
        "name",
        "business_type",
        "country",
        "currency",
        "is_active",
        "created_at",
    )

    list_filter = (
        "is_active",
        "country",
        "currency",
    )

    search_fields = (
        "name",
        "slug",
        "phone",
        "email",
    )

    readonly_fields = (
        "created_at",
        "updated_at",
    )

    prepopulated_fields = {
        "slug": ("name",),
    }


@admin.register(OrganizationMembership)
class OrganizationMembershipAdmin(admin.ModelAdmin):
    list_display = (
        "user",
        "organization",
        "role",
        "is_active",
        "created_at",
    )

    list_filter = (
        "role",
        "is_active",
        "organization",
    )

    search_fields = (
        "user__username",
        "user__email",
        "organization__name",
    )

    readonly_fields = (
        "created_at",
        "updated_at",
    )


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = (
        "organization",
        "user",
        "action",
        "model_name",
        "object_id",
        "created_at",
    )

    list_filter = (
        "organization",
        "action",
        "model_name",
    )

    search_fields = (
        "user__username",
        "model_name",
        "object_id",
        "description",
    )

    readonly_fields = (
        "organization",
        "user",
        "action",
        "model_name",
        "object_id",
        "description",
        "created_at",
    )