from rest_framework.routers import DefaultRouter

from .views import (
    SaleViewSet,
    SaleItemViewSet,
    SalePaymentViewSet,
    SaleRefundViewSet,
    SaleReturnViewSet,
    SaleReturnItemViewSet,
)


router = DefaultRouter()

router.register(
    "sales",
    SaleViewSet,
    basename="sale",
)

router.register(
    "sale-items",
    SaleItemViewSet,
    basename="sale-item",
)

router.register(
    "sale-payments",
    SalePaymentViewSet,
    basename="sale-payment",
)

router.register(
    "sale-refunds",
    SaleRefundViewSet,
    basename="sale-refund",
)

router.register(
    "sale-returns",
    SaleReturnViewSet,
    basename="sale-return",
)

router.register(
    "sale-return-items",
    SaleReturnItemViewSet,
    basename="sale-return-item",
)

urlpatterns = router.urls