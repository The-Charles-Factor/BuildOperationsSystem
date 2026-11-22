from rest_framework.routers import DefaultRouter

from .views import PurchaseItemViewSet, PurchaseViewSet


router = DefaultRouter()

router.register(
    "purchases",
    PurchaseViewSet,
    basename="purchase"
)

router.register(
    "purchase-items",
    PurchaseItemViewSet,
    basename="purchase-item"
)

urlpatterns = router.urls