from rest_framework.routers import DefaultRouter

from .views import CustomerAddressViewSet, CustomerViewSet


router = DefaultRouter()

router.register("customers", CustomerViewSet, basename="customer")
router.register(
    "customer-addresses",
    CustomerAddressViewSet,
    basename="customer-address"
)

urlpatterns = router.urls