from decimal import Decimal

from django.db import IntegrityError, transaction
from rest_framework import serializers

from core.tenant import get_current_organization

from .models import Expense, ExpenseCategory


def normalize_category_name(value):
    """
    Creates the canonical value used to detect duplicate categories.

    Examples:
        Electricity -> electricity
        electricity -> electricity
        ELECTRICITY -> electricity
        "  electricity  " -> electricity
        "building   materials" -> building materials
    """
    return " ".join(value.strip().casefold().split())


class ExpenseCategorySerializer(serializers.ModelSerializer):
    organization = serializers.PrimaryKeyRelatedField(
        read_only=True
    )

    name_normalized = serializers.CharField(
        read_only=True
    )

    class Meta:
        model = ExpenseCategory

        fields = [
            "id",
            "organization",
            "name",
            "name_normalized",
            "description",
            "is_active",
            "created_at",
            "updated_at",
        ]

        read_only_fields = [
            "id",
            "organization",
            "name_normalized",
            "created_at",
            "updated_at",
        ]

    def validate_name(self, value):
        value = " ".join(value.strip().split())

        if not value:
            raise serializers.ValidationError(
                "Category name cannot be empty."
            )

        if len(value) > 100:
            raise serializers.ValidationError(
                "Category name cannot exceed 100 characters."
            )

        return value

    def validate(self, attrs):
        request = self.context.get("request")

        if not request or not request.user.is_authenticated:
            raise serializers.ValidationError(
                "Authentication is required."
            )

        organization = get_current_organization(request.user)

        name = attrs.get("name")

        if name:
            normalized = normalize_category_name(name)

            existing = (
                ExpenseCategory.objects
                .filter(
                    organization=organization,
                    name_normalized=normalized,
                )
                .first()
            )

            current_instance = self.instance

            if existing and (
                current_instance is None
                or existing.pk != current_instance.pk
            ):
                raise serializers.ValidationError(
                    {
                        "name": (
                            f'A category named "{existing.name}" '
                            "already exists."
                        )
                    }
                )

        return attrs

    def create(self, validated_data):
        request = self.context.get("request")

        if not request or not request.user.is_authenticated:
            raise serializers.ValidationError(
                "Authentication is required."
            )

        organization = get_current_organization(request.user)

        name = validated_data["name"]
        normalized = normalize_category_name(name)

        existing = (
            ExpenseCategory.objects
            .filter(
                organization=organization,
                name_normalized=normalized,
            )
            .first()
        )

        if existing:
            return existing

        validated_data["organization"] = organization
        validated_data["name"] = " ".join(
            name.strip().split()
        )
        validated_data["name_normalized"] = normalized

        try:
            return ExpenseCategory.objects.create(
                **validated_data
            )
        except IntegrityError:
            existing = (
                ExpenseCategory.objects
                .filter(
                    organization=organization,
                    name_normalized=normalized,
                )
                .first()
            )

            if existing:
                return existing

            raise

    def update(self, instance, validated_data):
        if "name" in validated_data:
            name = validated_data["name"]
            name = " ".join(name.strip().split())

            validated_data["name"] = name
            validated_data["name_normalized"] = (
                normalize_category_name(name)
            )

        validated_data.pop("organization", None)

        return super().update(
            instance,
            validated_data,
        )


class ExpenseSerializer(serializers.ModelSerializer):
    organization = serializers.PrimaryKeyRelatedField(
        read_only=True
    )

    class Meta:
        model = Expense

        fields = [
            "id",
            "organization",
            "expense_number",
            "category",
            "description",
            "amount",
            "expense_date",
            "payment_method",
            "status",
            "paid_to",
            "receipt_number",
            "reference",
            "notes",
            "created_by",
            "approved_by",
            "approved_at",
            "paid_at",
            "created_at",
            "updated_at",
        ]

        read_only_fields = [
            "id",
            "organization",
            "expense_number",
            "status",
            "created_by",
            "approved_by",
            "approved_at",
            "paid_at",
            "created_at",
            "updated_at",
        ]

    def validate_category(self, value):
        request = self.context.get("request")

        if not request or not request.user.is_authenticated:
            raise serializers.ValidationError(
                "Authentication is required."
            )

        organization = get_current_organization(
            request.user
        )

        if value.organization_id != organization.id:
            raise serializers.ValidationError(
                "You cannot use an expense category "
                "from another organization."
            )

        if not value.is_active:
            raise serializers.ValidationError(
                "You cannot use an inactive expense category."
            )

        return value

    def validate_amount(self, value):
        if value <= Decimal("0.00"):
            raise serializers.ValidationError(
                "Expense amount must be greater than zero."
            )

        return value

    def validate_description(self, value):
        value = value.strip()

        if not value:
            raise serializers.ValidationError(
                "Description cannot be empty."
            )

        return value

    def create(self, validated_data):
        request = self.context.get("request")

        if not request or not request.user.is_authenticated:
            raise serializers.ValidationError(
                "Authentication is required."
            )

        organization = get_current_organization(
            request.user
        )

        with transaction.atomic():
            last_expense = (
                Expense.objects
                .select_for_update()
                .filter(
                    organization=organization,
                    expense_number__startswith="EXP-",
                )
                .order_by("-id")
                .first()
            )

            if last_expense:
                try:
                    last_number = int(
                        last_expense.expense_number.replace(
                            "EXP-",
                            "",
                            1,
                        )
                    )
                except (ValueError, TypeError):
                    last_number = 0
            else:
                last_number = 0

            expense_number = (
                f"EXP-{last_number + 1:06d}"
            )

            validated_data["organization"] = organization
            validated_data["created_by"] = request.user
            validated_data["expense_number"] = expense_number

            try:
                return Expense.objects.create(
                    **validated_data
                )
            except IntegrityError:
                # Retry once in case another transaction generated
                # the same number concurrently.
                latest_expense = (
                    Expense.objects
                    .filter(
                        organization=organization,
                        expense_number__startswith="EXP-",
                    )
                    .order_by("-id")
                    .first()
                )

                if latest_expense:
                    try:
                        latest_number = int(
                            latest_expense.expense_number.replace(
                                "EXP-",
                                "",
                                1,
                            )
                        )
                    except (ValueError, TypeError):
                        latest_number = 0
                else:
                    latest_number = 0

                validated_data["expense_number"] = (
                    f"EXP-{latest_number + 1:06d}"
                )

                return Expense.objects.create(
                    **validated_data
                )