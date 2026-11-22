from rest_framework import serializers


class DateRangeSerializer(serializers.Serializer):
    date_from = serializers.DateField(
        required=False
    )

    date_to = serializers.DateField(
        required=False
    )

    def validate(self, attrs):
        date_from = attrs.get("date_from")
        date_to = attrs.get("date_to")

        if (
            date_from
            and date_to
            and date_from > date_to
        ):
            raise serializers.ValidationError(
                {
                    "date_to": (
                        "date_to must be greater than "
                        "or equal to date_from."
                    )
                }
            )

        return attrs


class DashboardReportSerializer(
    serializers.Serializer
):
    sales = serializers.DictField()
    purchases = serializers.DictField()
    inventory = serializers.DictField()
    expenses = serializers.DictField()
    financial = serializers.DictField()


class TopProductSerializer(
    serializers.Serializer
):
    product_id = serializers.IntegerField()
    product__name = serializers.CharField()
    product__sku = serializers.CharField()
    quantity_sold = serializers.DecimalField(
        max_digits=14,
        decimal_places=2,
    )
    sales_value = serializers.DecimalField(
        max_digits=14,
        decimal_places=2,
    )


class ExpenseCategoryReportSerializer(
    serializers.Serializer
):
    category_id = serializers.IntegerField()
    category__name = serializers.CharField()
    total_amount = serializers.DecimalField(
        max_digits=14,
        decimal_places=2,
    )
    expense_count = serializers.IntegerField()