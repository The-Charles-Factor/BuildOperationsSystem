from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from core.services import create_audit_log
from .models import Expense


@transaction.atomic
def approve_expense(*, expense, approved_by):
    expense = (
        Expense.objects.select_for_update().get(
    pk=expense.pk
)
    )

    if expense.organization_id != getattr(
        approved_by,
        "organization_id",
        None,
    ):
        # Organization is determined from membership below.
        pass

    if expense.status != "pending":
        raise ValidationError(
            "Only pending expenses can be approved."
        )

    from core.tenant import (
        MultipleOrganizationsError,
        NoOrganizationError,
        get_current_organization,
    )

    try:
        organization = get_current_organization(approved_by)
    except NoOrganizationError as exc:
        raise ValidationError(str(exc))
    except MultipleOrganizationsError as exc:
        raise ValidationError(str(exc))

    if expense.organization_id != organization.id:
        raise ValidationError(
            "You cannot approve an expense from another organization."
        )

    expense.status = "approved"
    expense.approved_by = approved_by
    expense.approved_at = timezone.now()

    expense.save(
        update_fields=[
            "status",
            "approved_by",
            "approved_at",
            "updated_at",
        ]
    )

    create_audit_log(
        user=approved_by,
        organization=organization,
        action="approve",
        model_name="Expense",
        object_id=expense.id,
        description=(
            f"Expense {expense.expense_number} approved."
        ),
    )

    return expense


@transaction.atomic
def pay_expense(*, expense, payment_method, paid_by):
    expense = (
        Expense.objects.select_for_update().get(
    pk=expense.pk
)
    )

    from core.tenant import (
        MultipleOrganizationsError,
        NoOrganizationError,
        get_current_organization,
    )

    try:
        organization = get_current_organization(paid_by)
    except NoOrganizationError as exc:
        raise ValidationError(str(exc))
    except MultipleOrganizationsError as exc:
        raise ValidationError(str(exc))

    if expense.organization_id != organization.id:
        raise ValidationError(
            "You cannot pay an expense from another organization."
        )

    if expense.status != "approved":
        raise ValidationError(
            "Only approved expenses can be paid."
        )

    allowed_methods = {
        choice[0]
        for choice in Expense.PAYMENT_METHOD_CHOICES
    }

    if payment_method not in allowed_methods:
        raise ValidationError(
            {
                "payment_method": (
                    "Invalid payment method. "
                    f"Allowed values: "
                    f"{', '.join(sorted(allowed_methods))}."
                )
            }
        )

    expense.payment_method = payment_method
    expense.status = "paid"
    expense.paid_at = timezone.now()

    expense.save(
        update_fields=[
            "payment_method",
            "status",
            "paid_at",
            "updated_at",
        ]
    )

    create_audit_log(
        user=paid_by,
        organization=organization,
        action="complete",
        model_name="Expense",
        object_id=expense.id,
        description=(
            f"Expense {expense.expense_number} paid "
            f"using {expense.payment_method}."
        ),
    )

    return expense


@transaction.atomic
def cancel_expense(*, expense, cancelled_by):
    expense = (
        Expense.objects
        .select_for_update()
        .get(pk=expense.pk)
    )

    from core.tenant import (
        MultipleOrganizationsError,
        NoOrganizationError,
        get_current_organization,
    )

    try:
        organization = get_current_organization(cancelled_by)
    except NoOrganizationError as exc:
        raise ValidationError(str(exc))
    except MultipleOrganizationsError as exc:
        raise ValidationError(str(exc))

    if expense.organization_id != organization.id:
        raise ValidationError(
            "You cannot cancel an expense from another organization."
        )

    if expense.status == "paid":
        raise ValidationError(
            "A paid expense cannot be cancelled."
        )

    if expense.status == "cancelled":
        raise ValidationError(
            "This expense is already cancelled."
        )

    expense.status = "cancelled"

    expense.save(
        update_fields=[
            "status",
            "updated_at",
        ]
    )

    create_audit_log(
        user=cancelled_by,
        organization=organization,
        action="cancel",
        model_name="Expense",
        object_id=expense.id,
        description=(
            f"Expense {expense.expense_number} cancelled."
        ),
    )

    return expense