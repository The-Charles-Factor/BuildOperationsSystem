from decimal import Decimal

from django.contrib.auth.models import User
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from core.models import Organization, OrganizationMembership
from inventory.models import InventoryItem, StockMovement
from products.models import Brand, Category, Product
from suppliers.models import Supplier


from django.db import models 


from .models import Purchase, PurchasePayment


class PurchaseTenancyTests(APITestCase):
    def setUp(self):
        # ---------------------------------------------------------
        # Organizations
        # ---------------------------------------------------------
        self.org_a = Organization.objects.create(
            name="BuildOps Business A",
            slug="buildops-business-a",
        )

        self.org_b = Organization.objects.create(
            name="BuildOps Business B",
            slug="buildops-business-b",
        )

        # ---------------------------------------------------------
        # Users
        # ---------------------------------------------------------
        self.user_a = User.objects.create_user(
            username="purchase_user_a",
            password="testpass123",
        )

        self.user_b = User.objects.create_user(
            username="purchase_user_b",
            password="testpass123",
        )

        OrganizationMembership.objects.create(
            organization=self.org_a,
            user=self.user_a,
            role="owner",
        )

        OrganizationMembership.objects.create(
            organization=self.org_b,
            user=self.user_b,
            role="owner",
        )

        # ---------------------------------------------------------
        # Organization A supplier
        # ---------------------------------------------------------
        self.supplier_a = Supplier.objects.create(
            organization=self.org_a,
            name="Supplier A",
            company_name="Supplier A Ltd",
            phone="0711000001",
            email="suppliera@example.com",
        )

        # ---------------------------------------------------------
        # Organization B supplier
        # ---------------------------------------------------------
        self.supplier_b = Supplier.objects.create(
            organization=self.org_b,
            name="Supplier B",
            company_name="Supplier B Ltd",
            phone="0711000002",
            email="supplierb@example.com",
        )

        # ---------------------------------------------------------
        # Organization A product
        # ---------------------------------------------------------
        self.category_a = Category.objects.create(
            organization=self.org_a,
            name="Hardware",
        )

        self.brand_a = Brand.objects.create(
            organization=self.org_a,
            name="Brand A",
        )

        self.product_a = Product.objects.create(
            organization=self.org_a,
            sku="PROD-A-001",
            name="Product A",
            category=self.category_a,
            brand=self.brand_a,
            cost_price=Decimal("1000.00"),
            selling_price=Decimal("1500.00"),
            unit="piece",
            tax_rate=Decimal("0.00"),
        )

        # ---------------------------------------------------------
        # Organization B product
        # ---------------------------------------------------------
        self.category_b = Category.objects.create(
            organization=self.org_b,
            name="Hardware",
        )

        self.brand_b = Brand.objects.create(
            organization=self.org_b,
            name="Brand B",
        )

        self.product_b = Product.objects.create(
            organization=self.org_b,
            sku="PROD-B-001",
            name="Product B",
            category=self.category_b,
            brand=self.brand_b,
            cost_price=Decimal("2000.00"),
            selling_price=Decimal("3000.00"),
            unit="piece",
            tax_rate=Decimal("0.00"),
        )

        self.purchase_url = "/api/purchases/"

    # =========================================================
    # Helpers
    # =========================================================

    def authenticate_as_a(self):
        self.client.force_authenticate(user=self.user_a)

    def authenticate_as_b(self):
        self.client.force_authenticate(user=self.user_b)

    def purchase_payload(
        self,
        *,
        purchase_number="PO-A-001",
        supplier=None,
        product=None,
        quantity="1.00",
        unit_cost="1000.00",
    ):
        return {
            "purchase_number": purchase_number,
            "supplier": supplier or self.supplier_a.id,
            "purchase_date": "2026-10-01T10:00:00Z",
            "expected_delivery_date": "2026-10-05",
            "notes": "Test purchase",
            "items": [
                {
                    "product": product or self.product_a.id,
                    "quantity": quantity,
                    "unit_cost": unit_cost,
                    "tax_rate": "0.00",
                    "discount_amount": "0.00",
                }
            ],
        }

    def create_purchase_as_a(self, purchase_number="PO-A-001"):
        self.authenticate_as_a()

        response = self.client.post(
            self.purchase_url,
            self.purchase_payload(
                purchase_number=purchase_number
            ),
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_201_CREATED,
            response.data,
        )

        return Purchase.objects.get(
            purchase_number=purchase_number
        )

    # =========================================================
    # Tests
    # =========================================================

    def test_purchase_creation_assigns_current_organization(self):
        purchase = self.create_purchase_as_a()

        self.assertEqual(
            purchase.organization_id,
            self.org_a.id,
        )

        self.assertEqual(
            purchase.created_by_id,
            self.user_a.id,
        )

        self.assertEqual(
            purchase.supplier_id,
            self.supplier_a.id,
        )

    def test_purchase_list_is_tenant_isolated(self):
        purchase_a = self.create_purchase_as_a(
            purchase_number="PO-A-001"
        )

        self.authenticate_as_b()

        response = self.client.get(
            self.purchase_url
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )

        returned_ids = {
            item["id"]
            for item in response.data
        }

        self.assertNotIn(
            purchase_a.id,
            returned_ids,
        )

    def test_purchase_detail_cannot_access_another_organization(self):
        purchase_a = self.create_purchase_as_a()

        self.authenticate_as_b()

        response = self.client.get(
            f"{self.purchase_url}{purchase_a.id}/"
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_404_NOT_FOUND,
        )

    def test_purchase_cannot_use_supplier_from_another_organization(self):
        self.authenticate_as_a()

        response = self.client.post(
            self.purchase_url,
            self.purchase_payload(
                purchase_number="PO-CROSS-SUPPLIER",
                supplier=self.supplier_b.id,
            ),
            format="json",
        )

        self.assertIn(
            response.status_code,
            [
                status.HTTP_400_BAD_REQUEST,
                status.HTTP_403_FORBIDDEN,
            ],
        )

        self.assertFalse(
            Purchase.objects.filter(
                purchase_number="PO-CROSS-SUPPLIER"
            ).exists()
        )

    def test_purchase_cannot_use_product_from_another_organization(self):
        self.authenticate_as_a()

        response = self.client.post(
            self.purchase_url,
            self.purchase_payload(
                purchase_number="PO-CROSS-PRODUCT",
                product=self.product_b.id,
            ),
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )

        self.assertFalse(
            Purchase.objects.filter(
                purchase_number="PO-CROSS-PRODUCT"
            ).exists()
        )

    def test_purchase_order_and_receiving_are_tenant_scoped(self):
        purchase = self.create_purchase_as_a()

        # Order the purchase.
        response = self.client.post(
            f"{self.purchase_url}{purchase.id}/order/",
            {},
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
            response.data,
        )

        purchase.refresh_from_db()

        self.assertEqual(
            purchase.status,
            "ordered",
        )

        # Receive the purchase.
        response = self.client.post(
            f"{self.purchase_url}{purchase.id}/receive/",
            {
                "items": [
                    {
                        "purchase_item_id": purchase.items.first().id,
                        "quantity": "1.00",
                    }
                ]
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
            response.data,
        )

        purchase.refresh_from_db()

        self.assertEqual(
            purchase.status,
            "received",
        )

        inventory = InventoryItem.objects.get(
            organization=self.org_a,
            product=self.product_a,
        )

        self.assertEqual(
            inventory.quantity,
            Decimal("1.00"),
        )

        movement = StockMovement.objects.filter(
            organization=self.org_a,
            purchase=purchase,
        ).first()

        self.assertIsNotNone(movement)

        self.assertEqual(
            movement.quantity,
            Decimal("1.00"),
        )

    def test_purchase_payment_updates_payment_status(self):
        purchase = self.create_purchase_as_a()

        # A purchase must be ordered before payment.
        response = self.client.post(
            f"{self.purchase_url}{purchase.id}/order/",
            {},
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )

        # Partial payment.
        response = self.client.post(
            f"{self.purchase_url}{purchase.id}/pay/",
            {
                "amount": "400.00",
                "payment_method": "cash",
                "reference": "PAY-001",
                "notes": "Partial payment",
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_201_CREATED,
            response.data,
        )

        purchase.refresh_from_db()

        self.assertEqual(
            purchase.payment_status,
            "partially_paid",
        )

        self.assertEqual(
            PurchasePayment.objects.filter(
                purchase=purchase,
                organization=self.org_a,
            ).count(),
            1,
        )

        # Remaining payment.
        response = self.client.post(
            f"{self.purchase_url}{purchase.id}/pay/",
            {
                "amount": "600.00",
                "payment_method": "mpesa",
                "reference": "MPESA-002",
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_201_CREATED,
            response.data,
        )

        purchase.refresh_from_db()

        self.assertEqual(
            purchase.payment_status,
            "paid",
        )

        total_paid = (
            PurchasePayment.objects
            .filter(
                purchase=purchase,
                organization=self.org_a,
            )
            .aggregate(total=models.Sum("amount"))
        )

    def test_purchase_from_one_organization_cannot_be_ordered_by_another(self):
        purchase = self.create_purchase_as_a()

        self.authenticate_as_b()

        response = self.client.post(
            f"{self.purchase_url}{purchase.id}/order/",
            {},
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_404_NOT_FOUND,
        )

        purchase.refresh_from_db()

        self.assertEqual(
            purchase.status,
            "draft",
        )