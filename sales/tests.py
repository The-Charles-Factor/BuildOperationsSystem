from decimal import Decimal

from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIRequestFactory, force_authenticate

from core.models import Organization, OrganizationMembership
from inventory.models import InventoryItem, StockMovement
from products.models import Category, Product

from .models import Sale, SaleItem, SalePayment, SaleReturn, SaleReturnItem
from .payment_services import record_sale_payment
from .return_services import complete_sale_return
from .services import complete_sale

from customers.models import Customer


class SalesTenantTestCase(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="sales_user",
            password="password123",
        )

        self.other_user = User.objects.create_user(
            username="other_user",
            password="password123",
        )

        self.organization = Organization.objects.create(
            name="Sales Test Business",
            slug="sales-test-business",
        )

        self.other_organization = Organization.objects.create(
            name="Other Test Business",
            slug="other-test-business",
        )

        self.customer = Customer.objects.create(
            organization=self.organization,
            name="Test Customer",
            phone="0700000001",
        )

        self.other_customer = Customer.objects.create(
            organization=self.other_organization,
            name="Other Customer",
            phone="0700000002",
        )

        OrganizationMembership.objects.create(
            organization=self.organization,
            user=self.user,
            role="owner",
        )

        OrganizationMembership.objects.create(
            organization=self.other_organization,
            user=self.other_user,
            role="owner",
        )

        self.category = Category.objects.create(
            organization=self.organization,
            name="Test Category",
        )

        self.product = Product.objects.create(
            organization=self.organization,
            sku="TEST-001",
            name="Test Product",
            category=self.category,
            cost_price=Decimal("100.00"),
            selling_price=Decimal("150.00"),
        )

        self.inventory = InventoryItem.objects.create(
            organization=self.organization,
            product=self.product,
            quantity=Decimal("20.00"),
        )

    def create_sale(self, *, organization=None, customer=None):
        organization = organization or self.organization

        if customer is None:
            customer = (
                self.customer
                if organization == self.organization
                else self.other_customer
            )

        return Sale.objects.create(
            organization=organization,
            sale_number="SALE-001",
            customer=customer,
            subtotal=Decimal("300.00"),
            tax_amount=Decimal("0.00"),
            discount_amount=Decimal("0.00"),
            total_amount=Decimal("300.00"),
            created_by=self.user,
        )

    def create_sale_item(self, sale, quantity=Decimal("2.00")):
        return SaleItem.objects.create(
            organization=sale.organization,
            sale=sale,
            product=self.product,
            quantity=quantity,
            unit_price=Decimal("150.00"),
            tax_rate=Decimal("0.00"),
            discount_amount=Decimal("0.00"),
            line_total=Decimal("300.00"),
        )

    def test_sale_is_scoped_to_organization(self):
        sale = self.create_sale()

        self.assertEqual(sale.organization, self.organization)
        self.assertEqual(
            Sale.objects.filter(organization=self.organization).count(),
            1,
        )

    def test_complete_sale_reduces_inventory(self):
        sale = self.create_sale()
        self.create_sale_item(sale)

        complete_sale(
            sale=sale,
            user=self.user,
            organization=self.organization,
        )

        self.inventory.refresh_from_db()
        sale.refresh_from_db()

        self.assertEqual(self.inventory.quantity, Decimal("18.00"))
        self.assertEqual(sale.status, "completed")

        self.assertTrue(
            StockMovement.objects.filter(
                organization=self.organization,
                sale=sale,
                movement_type="sale",
                quantity=Decimal("2.00"),
            ).exists()
        )

    def test_complete_sale_rejects_cross_organization_sale(self):
        sale = self.create_sale(
            organization=self.other_organization,
        )

        self.create_sale_item(sale)

        with self.assertRaises(Exception):
            complete_sale(
                sale=sale,
                user=self.user,
                organization=self.organization,
            )

    def test_payment_is_scoped_to_organization(self):
        sale = self.create_sale()
        sale.status = "completed"
        sale.save(update_fields=["status"])

        payment = record_sale_payment(
            sale=sale,
            amount=Decimal("100.00"),
            payment_method="cash",
            received_by=self.user,
            organization=self.organization,
        )

        self.assertEqual(payment.organization, self.organization)
        self.assertEqual(payment.amount, Decimal("100.00"))

        sale.refresh_from_db()

        self.assertEqual(sale.amount_paid, Decimal("100.00"))
        self.assertEqual(sale.payment_status, "partially_paid")

    def test_payment_rejects_cross_organization_sale(self):
        sale = self.create_sale(
            organization=self.other_organization,
        )
        sale.status = "completed"
        sale.save(update_fields=["status"])

        with self.assertRaises(Exception):
            record_sale_payment(
                sale=sale,
                amount=Decimal("100.00"),
                payment_method="cash",
                received_by=self.user,
                organization=self.organization,
            )

    def test_sale_return_restores_inventory(self):
        sale = self.create_sale()
        sale.status = "completed"
        sale.save(update_fields=["status"])

        sale_item = self.create_sale_item(sale)

        self.inventory.quantity = Decimal("18.00")
        self.inventory.save(update_fields=["quantity"])

        sale_return = SaleReturn.objects.create(
            organization=self.organization,
            sale=sale,
            return_number="RET-001",
            reason="Customer return",
            created_by=self.user,
        )

        SaleReturnItem.objects.create(
            organization=self.organization,
            sale_return=sale_return,
            sale_item=sale_item,
            quantity=Decimal("2.00"),
        )

        complete_sale_return(
            sale_return=sale_return,
            user=self.user,
            organization=self.organization,
        )

        self.inventory.refresh_from_db()
        sale_return.refresh_from_db()
        sale.refresh_from_db()

        self.assertEqual(self.inventory.quantity, Decimal("20.00"))
        self.assertEqual(sale_return.status, "completed")
        self.assertEqual(sale.status, "returned")

        self.assertTrue(
            StockMovement.objects.filter(
                organization=self.organization,
                sale=sale,
                movement_type="return_in",
                quantity=Decimal("2.00"),
            ).exists()
        )

    def test_sale_return_rejects_cross_organization_return(self):
        sale = self.create_sale()
        sale.status = "completed"
        sale.save(update_fields=["status"])

        sale_item = self.create_sale_item(sale)

        sale_return = SaleReturn.objects.create(
            organization=self.other_organization,
            sale=sale,
            return_number="RET-002",
            reason="Cross organization test",
            created_by=self.user,
        )

        SaleReturnItem.objects.create(
            organization=self.other_organization,
            sale_return=sale_return,
            sale_item=sale_item,
            quantity=Decimal("1.00"),
        )

        with self.assertRaises(Exception):
            complete_sale_return(
                sale_return=sale_return,
                user=self.user,
                organization=self.organization,
            )