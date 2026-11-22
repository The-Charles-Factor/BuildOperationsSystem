from django.contrib import admin
from .models import Receipt


@admin.register(Receipt)
class ReceiptAdmin(admin.ModelAdmin):
    list_display = ('receipt_number', 'organization', 'transaction', 'is_printed', 'print_attempts', 'created_at')
    list_filter = ('is_printed', 'organization', 'created_at')
    search_fields = ('receipt_number', 'transaction__id')
    readonly_fields = ('receipt_number', 'receipt_payload', 'created_at', 'updated_at')
    ordering = ('-created_at',)