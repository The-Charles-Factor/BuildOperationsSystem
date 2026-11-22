from django.urls import path
from .views import MarkReceiptPrintedView, ReceiptListView

app_name = "receipts"

urlpatterns = [
    path("", ReceiptListView.as_view(), name="receipt-list"),
    path(
        "<str:receipt_number>/print/",
        MarkReceiptPrintedView.as_view(),
        name="receipt-mark-printed",
    ),
]