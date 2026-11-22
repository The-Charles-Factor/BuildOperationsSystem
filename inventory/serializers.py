from rest_framework import serializers

from .models import InventoryItem, StockMovement


class InventoryItemSerializer(serializers.ModelSerializer):
    organization = serializers.PrimaryKeyRelatedField(
        read_only=True
    )

    class Meta:
        model = InventoryItem
        fields = "__all__"
        read_only_fields = [
            "organization",
            "created_at",
            "updated_at",
        ]


class StockMovementSerializer(serializers.ModelSerializer):
    organization = serializers.PrimaryKeyRelatedField(
        read_only=True
    )

    class Meta:
        model = StockMovement
        fields = "__all__"
        read_only_fields = [
            "organization",
            "created_by",
            "created_at",
        ]