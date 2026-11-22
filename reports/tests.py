from decimal import Decimal

from django.contrib.auth.models import User
from django.test import TestCase
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from core.models import Organization, OrganizationMembership
from customers.models import Customer
from expenses.models import Expense, ExpenseCategory
from inventory.models import InventoryItem
from products.models import Brand, Category, Product
from purchases.models import (
    Purchase,
    PurchaseItem,
    PurchasePayment,
)
from sales.models import Sale, SaleItem
from suppliers.models import Supplier

from .services import (
    get_dashboard_summary,
    get_expense_by_category,
    get_expense_summary,
    get_inventory_summary,
    get_purchase_summary,
    get_sales_summary,
    get_top_products,
)


class ReportsServiceTests(TestCase):

    @classmethod
    def setUpTestData(cls):
        cls.user = User.objects.create_user(
            username="report_user",
            password="testpass123",
        )

        cls.other_user = User.objects.create_user(
            username="other_report_user",
            password="testpass123",
        )

        cls.organization = Organization.objects.create(
            name="Report Business",
            slug="report-business",
        )

        cls.other_organization = Organization.objects.create(
            name="Other Report Business",
            slug="other-report-business",
        )

        OrganizationMembership.objects.create(
            organization=cls.organization,
            user=cls.user,
            role="owner",
        )

        OrganizationMembership.objects.create(
            organization=cls.other_organization,
            user=cls.other_user,
            role="owner",
        )

        cls.category = Category.objects.create(
            organization=cls.organization,
            name="Test Category",
        )

        cls.brand = Brand.objects.create(
            organization=cls.organization,
            name="Test Brand",
        )

        cls.product = Product.objects.create(
            organization=cls.organization,
            sku="TEST-001",
            name="Test Product",
            category=cls.category,
            brand=cls.brand,
            cost_price=Decimal("3000.00"),
            selling_price=Decimal("5000.00"),
        )

        InventoryItem.objects.create(
            organization=cls.organization,
            product=cls.product,
            quantity=Decimal("20.00"),
            reorder_level=Decimal("5.00"),
            reorder_quantity=Decimal("10.00"),
        )

        cls.customer = Customer.objects.create(
            organization=cls.organization,
            name="Test Customer",
            customer_type="individual",
        )

        cls.supplier = Supplier.objects.create(
            organization=cls.organization,
            name="Test Supplier",
            company_name="Test Supplier Company",
            phone="0700000001",
            email="testsupplier@example.com",
        )

        cls.expense_category = ExpenseCategory.objects.create(
            organization=cls.organization,
            name="Test Expense",
        )

    def create_sale(
        self,
        sale_number,
        quantity=1,
        amount_paid=0,
        status="completed",
        organization=None,
        product=None,
        customer=None,
        user=None,
    ):
        organization = organization or self.organization
        product = product or self.product
        customer = customer or self.customer
        user = user or self.user

        sale = Sale.objects.create(
            organization=organization,
            sale_number=sale_number,
            customer=customer,
            sale_date=timezone.now(),
            status=status,
            payment_status=(
                "paid"
                if amount_paid > 0
                else "unpaid"
            ),
            payment_method="cash",
            subtotal=Decimal("5000.00") * quantity,
            tax_amount=Decimal("0.00"),
            discount_amount=Decimal("0.00"),
            total_amount=Decimal("5000.00") * quantity,
            amount_paid=Decimal(str(amount_paid)),
            created_by=user,
        )

        SaleItem.objects.create(
            organization=organization,
            sale=sale,
            product=product,
            quantity=Decimal(str(quantity)),
            unit_price=Decimal("5000.00"),
            tax_rate=Decimal("0.00"),
            discount_amount=Decimal("0.00"),
            line_total=Decimal("5000.00") * quantity,
        )

        return sale

    def create_purchase(
        self,
        purchase_number,
        total_amount,
        amount_paid=0,
        status="received",
        organization=None,
        supplier=None,
        product=None,
        user=None,
    ):
        organization = organization or self.organization
        supplier = supplier or self.supplier
        product = product or self.product
        user = user or self.user

        purchase = Purchase.objects.create(
            organization=organization,
            purchase_number=purchase_number,
            supplier=supplier,
            purchase_date=timezone.now(),
            status=status,
            payment_status=(
                "paid"
                if amount_paid >= total_amount
                else "partially_paid"
                if amount_paid > 0
                else "unpaid"
            ),
            subtotal=Decimal(str(total_amount)),
            tax_amount=Decimal("0.00"),
            discount_amount=Decimal("0.00"),
            total_amount=Decimal(str(total_amount)),
            created_by=user,
        )

        PurchaseItem.objects.create(
            organization=organization,
            purchase=purchase,
            product=product,
            quantity=Decimal("5.00"),
            unit_cost=Decimal("3000.00"),
            tax_rate=Decimal("0.00"),
            discount_amount=Decimal("0.00"),
            line_total=Decimal(str(total_amount)),
            received_quantity=Decimal("5.00"),
        )

        if amount_paid:
            PurchasePayment.objects.create(
                organization=organization,
                purchase=purchase,
                amount=Decimal(str(amount_paid)),
                payment_method="cash",
                paid_by=user,
            )

        return purchase

    def create_expense(
        self,
        expense_number,
        amount,
        status="paid",
        organization=None,
        category=None,
        user=None,
    ):
        organization = organization or self.organization
        category = category or self.expense_category
        user = user or self.user

        return Expense.objects.create(
            organization=organization,
            expense_number=expense_number,
            category=category,
            description="Test expense",
            amount=Decimal(str(amount)),
            expense_date=timezone.now(),
            payment_method="cash",
            status=status,
            created_by=user,
        )

    def test_sales_summary(self):
        self.create_sale(
            sale_number="TEST-SALE-001",
            amount_paid=5000,
        )

        summary = get_sales_summary(
            organization=self.organization,
        )

        self.assertEqual(
            summary["total_sales"],
            1,
        )

        self.assertEqual(
            summary["completed_sales"],
            1,
        )

        self.assertEqual(
            summary["revenue"],
            Decimal("5000.00"),
        )

        self.assertEqual(
            summary["amount_paid"],
            Decimal("5000.00"),
        )

        self.assertEqual(
            summary["outstanding_amount"],
            Decimal("0.00"),
        )

    def test_purchase_summary(self):
        self.create_purchase(
            purchase_number="TEST-PURCHASE-001",
            total_amount=10000,
            amount_paid=6000,
        )

        summary = get_purchase_summary(
            organization=self.organization,
        )

        self.assertEqual(
            summary["total_purchases"],
            1,
        )

        self.assertEqual(
            summary["purchase_value"],
            Decimal("10000.00"),
        )

        self.assertEqual(
            summary["amount_paid"],
            Decimal("6000.00"),
        )

        self.assertEqual(
            summary["outstanding_amount"],
            Decimal("4000.00"),
        )

    def test_inventory_summary(self):
        summary = get_inventory_summary(
            organization=self.organization,
        )

        self.assertEqual(
            summary["total_products"],
            1,
        )

        self.assertEqual(
            summary["inventory_items"],
            1,
        )

        self.assertEqual(
            summary["total_stock_quantity"],
            Decimal("20.00"),
        )

    def test_expense_summary(self):
        self.create_expense(
            expense_number="TEST-EXPENSE-001",
            amount=2500,
        )

        summary = get_expense_summary(
            organization=self.organization,
        )

        self.assertEqual(
            summary["total_expenses"],
            1,
        )

        self.assertEqual(
            summary["paid_expenses"],
            1,
        )

        self.assertEqual(
            summary["total_amount"],
            Decimal("2500.00"),
        )

        self.assertEqual(
            summary["paid_amount"],
            Decimal("2500.00"),
        )

    def test_top_products(self):
        self.create_sale(
            sale_number="TEST-SALE-002",
            quantity=2,
            amount_paid=10000,
        )

        products = list(
            get_top_products(
                organization=self.organization,
            )
        )

        self.assertEqual(
            len(products),
            1,
        )

        self.assertEqual(
            products[0]["product_id"],
            self.product.id,
        )

        self.assertEqual(
            products[0]["quantity_sold"],
            Decimal("2.00"),
        )

        self.assertEqual(
            products[0]["sales_value"],
            Decimal("10000.00"),
        )

    def test_expenses_by_category(self):
        self.create_expense(
            expense_number="TEST-EXPENSE-002",
            amount=1500,
        )

        self.create_expense(
            expense_number="TEST-EXPENSE-003",
            amount=2000,
        )

        results = list(
            get_expense_by_category(
                organization=self.organization,
            )
        )

        self.assertEqual(
            len(results),
            1,
        )

        self.assertEqual(
            results[0]["category_id"],
            self.expense_category.id,
        )

        self.assertEqual(
            results[0]["total_amount"],
            Decimal("3500.00"),
        )

        self.assertEqual(
            results[0]["expense_count"],
            2,
        )

    def test_reports_are_tenant_scoped(self):
        self.create_sale(
            sale_number="ORG-A-SALE",
            amount_paid=5000,
            organization=self.organization,
        )

        self.create_sale(
            sale_number="ORG-B-SALE",
            amount_paid=50000,
            organization=self.other_organization,
            product=self.product,
            customer=self.customer,
            user=self.other_user,
        )

        self.create_expense(
            expense_number="ORG-A-EXPENSE",
            amount=1000,
            organization=self.organization,
        )

        other_category = ExpenseCategory.objects.create(
            organization=self.other_organization,
            name="Other Expense",
        )

        self.create_expense(
            expense_number="ORG-B-EXPENSE",
            amount=9000,
            organization=self.other_organization,
            category=other_category,
            user=self.other_user,
        )

        sales = get_sales_summary(
            organization=self.organization,
        )

        expenses = get_expense_summary(
            organization=self.organization,
        )

        dashboard = get_dashboard_summary(
            organization=self.organization,
        )

        self.assertEqual(
            sales["revenue"],
            Decimal("5000.00"),
        )

        self.assertEqual(
            expenses["total_amount"],
            Decimal("1000.00"),
        )

        self.assertEqual(
            dashboard["sales"]["revenue"],
            Decimal("5000.00"),
        )

        self.assertEqual(
            dashboard["expenses"]["total_amount"],
            Decimal("1000.00"),
        )


class ReportsAPITests(APITestCase):

    @classmethod
    def setUpTestData(cls):
        cls.user = User.objects.create_user(
            username="api_report_user",
            password="testpass123",
        )

        cls.organization = Organization.objects.create(
            name="API Report Business",
            slug="api-report-business",
        )

        OrganizationMembership.objects.create(
            organization=cls.organization,
            user=cls.user,
            role="owner",
        )

    def setUp(self):
        self.client.force_authenticate(
            user=self.user,
        )

    def test_dashboard_requires_authentication(self):
        self.client.force_authenticate(
            user=None,
        )

        response = self.client.get(
            "/api/reports/dashboard/"
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_403_FORBIDDEN,
        )

    def test_dashboard_endpoint(self):
        response = self.client.get(
            "/api/reports/dashboard/"
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )

        for section in [
            "sales",
            "purchases",
            "inventory",
            "expenses",
            "financial",
        ]:
            self.assertIn(
                section,
                response.data,
            )

    def test_dashboard_accepts_date_range(self):
        response = self.client.get(
            "/api/reports/dashboard/",
            {
                "date_from": "2026-01-01",
                "date_to": "2026-12-31",
            },
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )

    def test_dashboard_rejects_invalid_date_range(self):
        response = self.client.get(
            "/api/reports/dashboard/",
            {
                "date_from": "2026-12-31",
                "date_to": "2026-01-01",
            },
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )

    def test_user_without_organization_cannot_access_reports(self):
        user = User.objects.create_user(
            username="no_org_report_user",
            password="testpass123",
        )

        self.client.force_authenticate(
            user=user,
        )

        response = self.client.get(
            "/api/reports/dashboard/"
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_403_FORBIDDEN,
        )

    def test_top_products_endpoint(self):
        response = self.client.get(
            "/api/reports/top-products/"
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )

        self.assertIsInstance(
            response.data,
            list,
        )

    def test_top_products_accepts_limit(self):
        response = self.client.get(
            "/api/reports/top-products/",
            {"limit": "5"},
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )

    def test_top_products_rejects_invalid_limit(self):
        response = self.client.get(
            "/api/reports/top-products/",
            {"limit": "0"},
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )

    def test_top_products_rejects_limit_above_100(self):
        response = self.client.get(
            "/api/reports/top-products/",
            {"limit": "101"},
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )

    def test_expenses_by_category_endpoint(self):
        response = self.client.get(
            "/api/reports/expenses-by-category/"
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )

        self.assertIsInstance(
            response.data,
            list,
        )

    def test_expenses_by_category_accepts_date_range(self):
        response = self.client.get(
            "/api/reports/expenses-by-category/",
            {
                "date_from": "2026-01-01",
                "date_to": "2026-12-31",
            },
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )