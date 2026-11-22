from rest_framework import serializers
from .models import Receipt


class ReceiptSerializer(serializers.ModelSerializer):
    class Meta:
        model = Receipt
        fields = [
            'id',
            'receipt_number',
            'is_printed',
            'print_attempts',
            'last_printed_at',
            'receipt_payload',
            'created_at',
        ]
        read_only_fields = ['id', 'receipt_number', 'print_attempts', 'receipt_payload', 'created_at']