from decimal import Decimal
from django.contrib.auth.models import User
from django.test import TestCase
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from core.models import (
    AuditLog,
    Organization,
    OrganizationMembership,
)
from core.tenant import (
    MultipleOrganizationsError,
    NoOrganizationError,
    get_current_organization,
)

from .models import Expense, ExpenseCategory
from .serializers import ExpenseSerializer
from .workflow_services import (
    approve_expense,
    cancel_expense,
    pay_expense,
)


class ExpenseTestBase(TestCase):
    """
    Shared test setup for the Expenses domain.
    """

    def setUp(self):
        self.user_a = User.objects.create_user(
            username="user_a",
            password="testpass123",
        )

        self.user_b = User.objects.create_user(
            username="user_b",
            password="testpass123",
        )

        self.organization_a = Organization.objects.create(
            name="BuildOps Hardware A",
            slug="buildops-hardware-a",
            business_type="Hardware",
        )

        self.organization_b = Organization.objects.create(
            name="BuildOps Hardware B",
            slug="buildops-hardware-b",
            business_type="Hardware",
        )

        OrganizationMembership.objects.create(
            user=self.user_a,
            organization=self.organization_a,
            role="admin",
        )

        OrganizationMembership.objects.create(
            user=self.user_b,
            organization=self.organization_b,
            role="admin",
        )

        self.category_a = ExpenseCategory.objects.create(
            organization=self.organization_a,
            name="Transport",
            description="Transport expenses",
        )

        self.category_b = ExpenseCategory.objects.create(
            organization=self.organization_b,
            name="Transport",
            description="Transport expenses",
        )

    def create_expense(
        self,
        *,
        organization=None,
        category=None,
        created_by=None,
        expense_number="EXP-001",
        status="pending",
    ):
        return Expense.objects.create(
            organization=organization or self.organization_a,
            expense_number=expense_number,
            category=category or self.category_a,
            description="Transport expense",
            amount=Decimal("1500.00"),
            expense_date=timezone.now(),
            status=status,
            created_by=created_by or self.user_a,
        )


class OrganizationResolutionTests(ExpenseTestBase):

    def test_user_with_one_active_organization_is_resolved(self):
        organization = get_current_organization(self.user_a)

        self.assertEqual(
            organization,
            self.organization_a,
        )

    def test_user_without_organization_is_rejected(self):
        user = User.objects.create_user(
            username="no_org_user",
            password="testpass123",
        )

        with self.assertRaises(NoOrganizationError):
            get_current_organization(user)

    def test_user_with_multiple_organizations_is_rejected(self):
        OrganizationMembership.objects.create(
            user=self.user_a,
            organization=self.organization_b,
            role="manager",
        )

        with self.assertRaises(MultipleOrganizationsError):
            get_current_organization(self.user_a)


class ExpenseCategoryTests(ExpenseTestBase):

    def test_category_belongs_to_correct_organization(self):
        self.assertEqual(
            self.category_a.organization_id,
            self.organization_a.id,
        )

        self.assertEqual(
            self.category_b.organization_id,
            self.organization_b.id,
        )

    def test_same_category_name_is_allowed_in_different_organizations(self):
        self.assertEqual(
            self.category_a.name,
            self.category_b.name,
        )

    def test_duplicate_category_name_is_rejected_within_same_organization(self):
        with self.assertRaises(Exception):
            ExpenseCategory.objects.create(
                organization=self.organization_a,
                name="Transport",
                description="Duplicate category",
            )


class ExpenseSerializerTenantTests(ExpenseTestBase):

    def test_category_from_another_organization_is_rejected(self):
        request = type(
            "Request",
            (),
            {"user": self.user_a},
        )()

        serializer = ExpenseSerializer(
            data={
                "expense_number": "EXP-100",
                "category": self.category_b.id,
                "description": "Wrong organization category",
                "amount": "1500.00",
                "expense_date": timezone.now(),
            },
            context={"request": request},
        )

        self.assertFalse(serializer.is_valid())

        self.assertIn(
            "category",
            serializer.errors,
        )

    def test_negative_amount_is_rejected(self):
        request = type(
            "Request",
            (),
            {"user": self.user_a},
        )()

        serializer = ExpenseSerializer(
            data={
                "expense_number": "EXP-101",
                "category": self.category_a.id,
                "description": "Invalid amount",
                "amount": "-100.00",
                "expense_date": timezone.now(),
            },
            context={"request": request},
        )

        self.assertFalse(serializer.is_valid())

        self.assertIn(
            "amount",
            serializer.errors,
        )

    def test_zero_amount_is_rejected(self):
        request = type(
            "Request",
            (),
            {"user": self.user_a},
        )()

        serializer = ExpenseSerializer(
            data={
                "expense_number": "EXP-102",
                "category": self.category_a.id,
                "description": "Zero amount",
                "amount": "0.00",
                "expense_date": timezone.now(),
            },
            context={"request": request},
        )

        self.assertFalse(serializer.is_valid())

        self.assertIn(
            "amount",
            serializer.errors,
        )

    def test_blank_description_is_rejected(self):
        request = type(
            "Request",
            (),
            {"user": self.user_a},
        )()

        serializer = ExpenseSerializer(
            data={
                "expense_number": "EXP-103",
                "category": self.category_a.id,
                "description": "   ",
                "amount": "500.00",
                "expense_date": timezone.now(),
            },
            context={"request": request},
        )

        self.assertFalse(serializer.is_valid())

        self.assertIn(
            "description",
            serializer.errors,
        )


class ExpenseWorkflowTests(ExpenseTestBase):

    def test_pending_expense_can_be_approved(self):
        expense = self.create_expense()

        result = approve_expense(
            expense=expense,
            approved_by=self.user_a,
        )

        result.refresh_from_db()

        self.assertEqual(
            result.status,
            "approved",
        )

        self.assertEqual(
            result.approved_by,
            self.user_a,
        )

        self.assertIsNotNone(
            result.approved_at,
        )

    def test_approved_expense_can_be_paid(self):
        expense = self.create_expense()

        approve_expense(
            expense=expense,
            approved_by=self.user_a,
        )

        result = pay_expense(
            expense=expense,
            payment_method="cash",
            paid_by=self.user_a,
        )

        result.refresh_from_db()

        self.assertEqual(
            result.status,
            "paid",
        )

        self.assertEqual(
            result.payment_method,
            "cash",
        )

        self.assertIsNotNone(
            result.paid_at,
        )

    def test_pending_expense_cannot_be_paid(self):
        expense = self.create_expense()

        with self.assertRaises(ValidationError):
            pay_expense(
                expense=expense,
                payment_method="cash",
                paid_by=self.user_a,
            )

    def test_paid_expense_cannot_be_cancelled(self):
        expense = self.create_expense()

        approve_expense(
            expense=expense,
            approved_by=self.user_a,
        )

        pay_expense(
            expense=expense,
            payment_method="cash",
            paid_by=self.user_a,
        )

        with self.assertRaises(ValidationError):
            cancel_expense(
                expense=expense,
                cancelled_by=self.user_a,
            )

    def test_pending_expense_can_be_cancelled(self):
        expense = self.create_expense()

        result = cancel_expense(
            expense=expense,
            cancelled_by=self.user_a,
        )

        result.refresh_from_db()

        self.assertEqual(
            result.status,
            "cancelled",
        )

    def test_cancelled_expense_cannot_be_cancelled_again(self):
        expense = self.create_expense()

        cancel_expense(
            expense=expense,
            cancelled_by=self.user_a,
        )

        with self.assertRaises(ValidationError):
            cancel_expense(
                expense=expense,
                cancelled_by=self.user_a,
            )

    def test_approved_expense_cannot_be_approved_again(self):
        expense = self.create_expense()

        approve_expense(
            expense=expense,
            approved_by=self.user_a,
        )

        with self.assertRaises(ValidationError):
            approve_expense(
                expense=expense,
                approved_by=self.user_a,
            )

    def test_invalid_payment_method_is_rejected(self):
        expense = self.create_expense()

        approve_expense(
            expense=expense,
            approved_by=self.user_a,
        )

        with self.assertRaises(ValidationError):
            pay_expense(
                expense=expense,
                payment_method="bitcoin",
                paid_by=self.user_a,
            )


class ExpenseTenantIsolationTests(ExpenseTestBase):

    def test_user_cannot_approve_another_organization_expense(self):
        expense = self.create_expense(
            organization=self.organization_a,
            category=self.category_a,
            created_by=self.user_a,
        )

        with self.assertRaises(ValidationError):
            approve_expense(
                expense=expense,
                approved_by=self.user_b,
            )

        expense.refresh_from_db()

        self.assertEqual(
            expense.status,
            "pending",
        )

    def test_user_cannot_pay_another_organization_expense(self):
        expense = self.create_expense(
            organization=self.organization_a,
            category=self.category_a,
            created_by=self.user_a,
        )

        approve_expense(
            expense=expense,
            approved_by=self.user_a,
        )

        with self.assertRaises(ValidationError):
            pay_expense(
                expense=expense,
                payment_method="cash",
                paid_by=self.user_b,
            )

        expense.refresh_from_db()

        self.assertEqual(
            expense.status,
            "approved",
        )

    def test_user_cannot_cancel_another_organization_expense(self):
        expense = self.create_expense(
            organization=self.organization_a,
            category=self.category_a,
            created_by=self.user_a,
        )

        with self.assertRaises(ValidationError):
            cancel_expense(
                expense=expense,
                cancelled_by=self.user_b,
            )

        expense.refresh_from_db()

        self.assertEqual(
            expense.status,
            "pending",
        )


class ExpenseAuditLogTests(ExpenseTestBase):

    def test_approval_creates_audit_log(self):
        expense = self.create_expense()

        approve_expense(
            expense=expense,
            approved_by=self.user_a,
        )

        audit = AuditLog.objects.filter(
            organization=self.organization_a,
            model_name="Expense",
            object_id=str(expense.id),
            action="approve",
        ).first()

        self.assertIsNotNone(audit)
        self.assertEqual(
            audit.user,
            self.user_a,
        )

    def test_payment_creates_audit_log(self):
        expense = self.create_expense()

        approve_expense(
            expense=expense,
            approved_by=self.user_a,
        )

        pay_expense(
            expense=expense,
            payment_method="mpesa",
            paid_by=self.user_a,
        )

        audit = AuditLog.objects.filter(
            organization=self.organization_a,
            model_name="Expense",
            object_id=str(expense.id),
            action="complete",
        ).first()

        self.assertIsNotNone(audit)

    def test_cancellation_creates_audit_log(self):
        expense = self.create_expense()

        cancel_expense(
            expense=expense,
            cancelled_by=self.user_a,
        )

        audit = AuditLog.objects.filter(
            organization=self.organization_a,
            model_name="Expense",
            object_id=str(expense.id),
            action="cancel",
        ).first()

        self.assertIsNotNone(audit)