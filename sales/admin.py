from django.contrib import admin

from .models import (
    Sale,
    SaleItem,
    SalePayment,
    SaleRefund,
    SaleReturn,
    SaleReturnItem,
)


admin.site.register(Sale)
admin.site.register(SaleItem)
admin.site.register(SalePayment)
admin.site.register(SaleRefund)
admin.site.register(SaleReturn)
admin.site.register(SaleReturnItem)
