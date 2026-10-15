

from django.urls import path
from . import views

urlpatterns = [
    path("", views.home, name="home"),
    path("checkout/", views.checkout, name="checkout"),
    path("cart/update/", views.cart_api, name="cart_api"),
    path("inventory/", views.inventory_dashboard, name="inventory"),
    path("track-order/", views.track_order, name="track_order"),
    path("sales-report/", views.sales_report, name="sales_report"),
    path("product/<int:product_id>/",views.product_detail,name="product_detail"),
]
