from decimal import Decimal
from unittest.mock import patch

from django.contrib.auth.models import User
from django.test import TestCase
from django.utils import timezone

from core.models import Organization, OrganizationMembership
from customers.models import Customer
from products.models import Category, Product
from sales.models import Sale, SaleItem
from inventory.models import InventoryItem
from suppliers.models import Supplier
from purchases.models import Purchase, PurchaseItem, PurchasePayment

from ai.intelligence.sales import (
    get_sales_performance,
    get_top_selling_products,
)
from ai.intelligence.products import (
    get_product_profitability,
)
from ai.intelligence.inventory import (
    get_inventory_overview,
    get_inventory_risk,
)
from ai.intelligence.customers import (
    get_customer_receivables,
)
from ai.intelligence.suppliers import (
    get_supplier_payables,
)

from ai.services import AIService
from ai.tools.registry import (
    get_tool,
    list_tools,
    get_tools_for_user,
)

from ai.providers.base import AIProvider
from ai.providers.openai_provider import OpenAIProvider


class AITestDataMixin:
    @classmethod
    def create_organization(cls, name):
        organization = Organization.objects.create(
            name=name,
            slug=name.lower().replace(" ", "-"),
            business_type="Hardware and Building Materials",
            city="Kitengela",
            country="Kenya",
            currency="KES",
            timezone="Africa/Nairobi",
        )

        OrganizationMembership.objects.create(
            organization=organization,
            user=cls.user,
            role="admin",
            is_active=True,
        )

        return organization


class SalesIntelligenceTests(AITestDataMixin, TestCase):

    @classmethod
    def setUpTestData(cls):
        cls.user = User.objects.create_user(
            username="ai_test_user",
            password="testpass123",
        )

        cls.organization = cls.create_organization(
            "AI Sales Test Organization"
        )

        cls.category = Category.objects.create(
            name="AI Test Category",
            organization=cls.organization,
        )

        cls.product = Product.objects.create(
            sku="AI-TEST-001",
            name="AI Test Faucet",
            category=cls.category,
            cost_price=Decimal("3000.00"),
            selling_price=Decimal("5000.00"),
            organization=cls.organization,
        )

        cls.customer = Customer.objects.create(
            name="AI Test Customer",
            customer_type="individual",
            organization=cls.organization,
        )

    def create_sale(
        self,
        sale_number,
        quantity=1,
        amount_paid=0,
        status="completed",
    ):
        sale = Sale.objects.create(
            sale_number=sale_number,
            customer=self.customer,
            sale_date=timezone.now(),
            status=status,
            payment_status=(
                "paid"
                if amount_paid >= 5000 * quantity
                else "partially_paid"
                if amount_paid > 0
                else "unpaid"
            ),
            payment_method="cash",
            subtotal=Decimal("5000.00") * quantity,
            tax_amount=Decimal("0.00"),
            discount_amount=Decimal("0.00"),
            total_amount=Decimal("5000.00") * quantity,
            amount_paid=Decimal(str(amount_paid)),
            created_by=self.user,
            organization=self.organization,
        )

        SaleItem.objects.create(
            sale=sale,
            product=self.product,
            quantity=Decimal(str(quantity)),
            unit_price=Decimal("5000.00"),
            tax_rate=Decimal("0.00"),
            discount_amount=Decimal("0.00"),
            line_total=Decimal("5000.00") * quantity,
            organization=self.organization,
        )

        return sale

    def test_sales_performance(self):
        self.create_sale(
            sale_number="AI-SALE-001",
            quantity=2,
            amount_paid=5000,
        )

        result = get_sales_performance(
            self.organization
        )

        self.assertEqual(
            result["total_transactions"],
            1,
        )

        self.assertEqual(
            result["total_sales"],
            Decimal("10000.00"),
        )

        self.assertEqual(
            result["total_amount_paid"],
            Decimal("5000.00"),
        )

    def test_cancelled_sales_are_excluded(self):
        self.create_sale(
            sale_number="AI-SALE-002",
            quantity=1,
            amount_paid=0,
            status="cancelled",
        )

        result = get_sales_performance(
            self.organization
        )

        self.assertEqual(
            result["total_transactions"],
            0,
        )

        self.assertEqual(
            result["total_sales"],
            Decimal("0.00"),
        )

    def test_top_selling_products(self):
        self.create_sale(
            sale_number="AI-SALE-003",
            quantity=3,
            amount_paid=15000,
        )

        result = get_top_selling_products(
            self.organization
        )

        self.assertEqual(len(result), 1)
        self.assertEqual(
            result[0]["product_id"],
            self.product.id,
        )
        self.assertEqual(
            result[0]["quantity_sold"],
            Decimal("3.00"),
        )
        self.assertEqual(
            result[0]["revenue"],
            Decimal("15000.00"),
        )


class ProductIntelligenceTests(AITestDataMixin, TestCase):

    @classmethod
    def setUpTestData(cls):
        cls.user = User.objects.create_user(
            username="product_ai_user",
            password="testpass123",
        )

        cls.organization = cls.create_organization(
            "AI Product Test Organization"
        )

        cls.category = Category.objects.create(
            name="Product AI Category",
            organization=cls.organization,
        )

        cls.product = Product.objects.create(
            sku="AI-PROD-001",
            name="Product Test Faucet",
            category=cls.category,
            cost_price=Decimal("3000.00"),
            selling_price=Decimal("5000.00"),
            organization=cls.organization,
        )

        cls.customer = Customer.objects.create(
            name="Product Test Customer",
            customer_type="individual",
            organization=cls.organization,
        )

    def create_sale(
        self,
        sale_number,
        quantity=1,
        amount_paid=0,
        status="completed",
    ):
        sale = Sale.objects.create(
            sale_number=sale_number,
            customer=self.customer,
            sale_date=timezone.now(),
            status=status,
            payment_status=(
                "paid"
                if amount_paid >= 5000 * quantity
                else "partially_paid"
                if amount_paid > 0
                else "unpaid"
            ),
            payment_method="cash",
            subtotal=Decimal("5000.00") * quantity,
            tax_amount=Decimal("0.00"),
            discount_amount=Decimal("0.00"),
            total_amount=Decimal("5000.00") * quantity,
            amount_paid=Decimal(str(amount_paid)),
            created_by=self.user,
            organization=self.organization,
        )

        SaleItem.objects.create(
            sale=sale,
            product=self.product,
            quantity=Decimal(str(quantity)),
            unit_price=Decimal("5000.00"),
            tax_rate=Decimal("0.00"),
            discount_amount=Decimal("0.00"),
            line_total=Decimal("5000.00") * quantity,
            organization=self.organization,
        )

    def test_product_profitability(self):
        self.create_sale(
            "AI-PROFIT-001",
            quantity=2,
            amount_paid=10000,
        )

        result = get_product_profitability(
            self.organization
        )

        self.assertEqual(len(result), 1)

        product = result[0]

        self.assertEqual(
            product["product_id"],
            self.product.id,
        )
        self.assertEqual(
            product["quantity_sold"],
            Decimal("2.00"),
        )
        self.assertEqual(
            product["revenue"],
            Decimal("10000.00"),
        )

    def test_cancelled_sales_do_not_affect_profitability(self):
        self.create_sale(
            "AI-PROFIT-002",
            quantity=2,
            amount_paid=0,
            status="cancelled",
        )

        result = get_product_profitability(
            self.organization
        )

        self.assertEqual(result, [])


class InventoryIntelligenceTests(AITestDataMixin, TestCase):

    @classmethod
    def setUpTestData(cls):
        cls.user = User.objects.create_user(
            username="inventory_ai_user",
            password="testpass123",
        )

        cls.organization = cls.create_organization(
            "AI Inventory Test Organization"
        )

        cls.category = Category.objects.create(
            name="Inventory AI Category",
            organization=cls.organization,
        )

        cls.product = Product.objects.create(
            sku="AI-INV-001",
            name="Inventory Test Faucet",
            category=cls.category,
            cost_price=Decimal("3000.00"),
            selling_price=Decimal("5000.00"),
            organization=cls.organization,
        )

        cls.inventory = InventoryItem.objects.create(
            product=cls.product,
            quantity=Decimal("10.00"),
            reorder_level=Decimal("5.00"),
            reorder_quantity=Decimal("10.00"),
            organization=cls.organization,
        )

    def test_inventory_overview(self):
        result = get_inventory_overview(
            self.organization
        )

        self.assertEqual(
            result["inventory_items"],
            1,
        )
        self.assertEqual(
            result["total_quantity"],
            Decimal("10.00"),
        )
        self.assertEqual(
            result["total_inventory_value"],
            Decimal("30000.00"),
        )
        self.assertEqual(
            result["low_stock_items"],
            0,
        )
        self.assertEqual(
            result["out_of_stock_items"],
            0,
        )

    def test_inventory_risk_healthy(self):
        result = get_inventory_risk(
            self.organization
        )

        self.assertEqual(len(result), 1)
        self.assertEqual(
            result[0]["product_id"],
            self.product.id,
        )
        self.assertEqual(
            result[0]["risk"],
            "healthy",
        )
        self.assertEqual(
            result[0]["stock_value"],
            Decimal("30000.00"),
        )

    def test_inventory_risk_low_stock(self):
        self.inventory.quantity = Decimal("5.00")
        self.inventory.save()

        result = get_inventory_risk(
            self.organization
        )

        self.assertEqual(
            result[0]["risk"],
            "low_stock",
        )

    def test_inventory_risk_out_of_stock(self):
        self.inventory.quantity = Decimal("0.00")
        self.inventory.save()

        result = get_inventory_risk(
            self.organization
        )

        self.assertEqual(
            result[0]["risk"],
            "out_of_stock",
        )


class CustomerIntelligenceTests(AITestDataMixin, TestCase):

    @classmethod
    def setUpTestData(cls):
        cls.user = User.objects.create_user(
            username="customer_ai_user",
            password="testpass123",
        )

        cls.organization = cls.create_organization(
            "AI Customer Test Organization"
        )

        cls.category = Category.objects.create(
            name="Customer AI Category",
            organization=cls.organization,
        )

        cls.product = Product.objects.create(
            sku="AI-CUST-001",
            name="Customer Test Faucet",
            category=cls.category,
            cost_price=Decimal("3000.00"),
            selling_price=Decimal("5000.00"),
            organization=cls.organization,
        )

        cls.customer = Customer.objects.create(
            name="Receivable Customer",
            company_name="Receivable Hardware",
            customer_type="business",
            organization=cls.organization,
        )

    def create_sale(
        self,
        sale_number,
        amount_paid,
        quantity=1,
    ):
        sale = Sale.objects.create(
            sale_number=sale_number,
            customer=self.customer,
            sale_date=timezone.now(),
            status="completed",
            payment_status=(
                "paid"
                if amount_paid >= 5000 * quantity
                else "partially_paid"
                if amount_paid > 0
                else "unpaid"
            ),
            payment_method="cash",
            subtotal=Decimal("5000.00") * quantity,
            tax_amount=Decimal("0.00"),
            discount_amount=Decimal("0.00"),
            total_amount=Decimal("5000.00") * quantity,
            amount_paid=Decimal(str(amount_paid)),
            created_by=self.user,
            organization=self.organization,
        )

        SaleItem.objects.create(
            sale=sale,
            product=self.product,
            quantity=Decimal(str(quantity)),
            unit_price=Decimal("5000.00"),
            tax_rate=Decimal("0.00"),
            discount_amount=Decimal("0.00"),
            line_total=Decimal("5000.00") * quantity,
            organization=self.organization,
        )

    def test_customer_receivable(self):
        self.create_sale(
            "AI-CUST-SALE-001",
            amount_paid=3000,
        )

        result = get_customer_receivables(
            self.organization
        )

        self.assertEqual(len(result), 1)

        customer = result[0]

        self.assertEqual(
            customer["customer_id"],
            self.customer.id,
        )
        self.assertEqual(
            customer["total_sales"],
            Decimal("5000.00"),
        )
        self.assertEqual(
            customer["amount_paid"],
            Decimal("3000.00"),
        )
        self.assertEqual(
            customer["outstanding_amount"],
            Decimal("2000.00"),
        )

    def test_fully_paid_customer_is_excluded(self):
        self.create_sale(
            "AI-CUST-SALE-002",
            amount_paid=5000,
        )

        result = get_customer_receivables(
            self.organization
        )

        self.assertEqual(result, [])

    def test_customer_receivables_support_date_range(self):
        self.create_sale(
            "AI-CUST-SALE-003",
            amount_paid=2000,
        )

        today = timezone.now().date()

        result = get_customer_receivables(
            self.organization,
            date_from=today,
            date_to=today,
        )

        self.assertEqual(len(result), 1)


class SupplierIntelligenceTests(AITestDataMixin, TestCase):

    @classmethod
    def setUpTestData(cls):
        cls.user = User.objects.create_user(
            username="supplier_ai_user",
            password="testpass123",
        )

        cls.organization = cls.create_organization(
            "AI Supplier Test Organization"
        )

        cls.category = Category.objects.create(
            name="Supplier AI Category",
            organization=cls.organization,
        )

        cls.product = Product.objects.create(
            sku="AI-SUP-001",
            name="Supplier Test Faucet",
            category=cls.category,
            cost_price=Decimal("3000.00"),
            selling_price=Decimal("5000.00"),
            organization=cls.organization,
        )

        cls.supplier = Supplier.objects.create(
            name="Payable Supplier",
            company_name="Payable Hardware Supplies",
            phone="0700000099",
            email="payable@example.com",
            organization=cls.organization,
        )

    def create_purchase(
        self,
        purchase_number,
        total_amount,
        amount_paid=0,
        status="received",
    ):
        purchase = Purchase.objects.create(
            purchase_number=purchase_number,
            supplier=self.supplier,
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
            created_by=self.user,
            organization=self.organization,
        )

        PurchaseItem.objects.create(
            purchase=purchase,
            product=self.product,
            quantity=Decimal("5.00"),
            unit_cost=Decimal("3000.00"),
            tax_rate=Decimal("0.00"),
            discount_amount=Decimal("0.00"),
            line_total=Decimal(str(total_amount)),
            received_quantity=Decimal("5.00"),
            organization=self.organization,
        )

        if amount_paid:
            PurchasePayment.objects.create(
                purchase=purchase,
                amount=Decimal(str(amount_paid)),
                payment_method="cash",
                paid_by=self.user,
                organization=self.organization,
            )

        return purchase

    def test_supplier_payable(self):
        self.create_purchase(
            "AI-SUP-PUR-001",
            total_amount=15000,
            amount_paid=5000,
        )

        result = get_supplier_payables(
            self.organization
        )

        self.assertEqual(len(result), 1)

        supplier = result[0]

        self.assertEqual(
            supplier["supplier_id"],
            self.supplier.id,
        )
        self.assertEqual(
            supplier["purchase_value"],
            Decimal("15000.00"),
        )
        self.assertEqual(
            supplier["amount_paid"],
            Decimal("5000.00"),
        )
        self.assertEqual(
            supplier["outstanding_amount"],
            Decimal("10000.00"),
        )

    def test_fully_paid_supplier_is_excluded(self):
        self.create_purchase(
            "AI-SUP-PUR-002",
            total_amount=15000,
            amount_paid=15000,
        )

        result = get_supplier_payables(
            self.organization
        )

        self.assertEqual(result, [])

    def test_cancelled_purchase_is_excluded(self):
        self.create_purchase(
            "AI-SUP-PUR-003",
            total_amount=15000,
            amount_paid=0,
            status="cancelled",
        )

        result = get_supplier_payables(
            self.organization
        )

        self.assertEqual(result, [])


class AIToolRegistryTests(AITestDataMixin, TestCase):

    @classmethod
    def setUpTestData(cls):
        cls.user = User.objects.create_user(
            username="ai_tools_user",
            password="testpass123",
        )

        cls.organization = cls.create_organization(
            "AI Tools Test Organization"
        )

    def test_registered_tools_exist(self):
        tools = list_tools()

        self.assertGreaterEqual(len(tools), 7)

        tool_names = {
            tool["name"]
            for tool in tools
        }

        expected_tools = {
            "sales_performance",
            "top_selling_products",
            "product_profitability",
            "inventory_overview",
            "inventory_risk",
            "customer_receivables",
            "supplier_payables",
        }

        self.assertTrue(
            expected_tools.issubset(tool_names)
        )

    def test_get_tool_returns_registered_tool(self):
        tool = get_tool("sales_performance")

        self.assertEqual(
            tool["function"].__name__,
            "get_sales_performance",
        )

    def test_unknown_tool_is_rejected(self):
        with self.assertRaises(ValueError):
            get_tool("delete_database")

    def test_ai_service_lists_tools(self):
        service = AIService()

        tools = service.available_tools(
            user=self.user,
            organization=self.organization,
        )

        self.assertGreaterEqual(
            len(tools),
            7,
        )

    def test_ai_service_executes_tool(self):
        service = AIService()

        result = service.execute_tool(
            "inventory_overview",
            user=self.user,
            organization=self.organization,
        )

        self.assertIn(
            "inventory_items",
            result,
        )

        self.assertIn(
            "total_inventory_value",
            result,
        )

    def test_sales_user_has_limited_ai_access(self):
        sales_user = User.objects.create_user(
            username="ai_sales_user",
            password="testpass123",
        )

        OrganizationMembership.objects.create(
            organization=self.organization,
            user=sales_user,
            role="sales",
            is_active=True,
        )

        tools = get_tools_for_user(
            sales_user,
            self.organization,
        )

        tool_names = {
            tool["name"]
            for tool in tools
        }

        self.assertIn(
            "sales_performance",
            tool_names,
        )

        self.assertNotIn(
            "inventory_overview",
            tool_names,
        )


class AIProviderTests(AITestDataMixin, TestCase):

    @classmethod
    def setUpTestData(cls):
        cls.user = User.objects.create_user(
            username="ai_provider_user",
            password="testpass123",
        )

        cls.organization = cls.create_organization(
            "AI Provider Test Organization"
        )

    def test_openai_provider_implements_provider_contract(self):
        provider = OpenAIProvider()

        self.assertIsInstance(
            provider,
            AIProvider,
        )

    def test_ai_service_rejects_missing_provider(self):
        service = AIService()

        with self.assertRaises(RuntimeError):
            service.answer(
                question="How are sales doing?",
                context={},
                user=self.user,
                organization=self.organization,
            )

    @patch("ai.providers.openai_provider.OpenAI")
    def test_openai_provider_generates_response(
        self,
        mock_openai,
    ):
        mock_response = (
            mock_openai
            .return_value
            .responses
            .create
            .return_value
        )

        mock_response.output_text = (
            "Sales are performing well."
        )

        provider = OpenAIProvider()

        result = provider.generate(
            question="How are sales doing?",
            context={
                "revenue": "485000.00"
            },
            user=self.user,
            organization=self.organization,
        )

        self.assertEqual(
            result,
            "Sales are performing well.",
        )

        mock_openai.return_value.responses.create.assert_called_once()