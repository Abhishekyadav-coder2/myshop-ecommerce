from django.contrib import messages
from django.contrib import admin
from .models import Product, Order, OrderItem
from django.db import transaction
from django.db.models import Sum


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "name",
        "price",
        "stock",
        "total_sold",
        "stock_status",
        "is_available",
    )
    search_fields = ("name", "category")
    list_filter = ("category", "is_available")

    
    def changelist_view(self, request, extra_context=None):
        low_stock_count = Product.objects.filter(
            stock__lte=5
        ).count()

        if low_stock_count:
            self.message_user(
                request,
                f"Low-stock alert: {low_stock_count} product(s) "
                "have 5 or fewer units remaining.",
                level=messages.WARNING,
            )

        return super().changelist_view(request, extra_context)


    @admin.display(description="Units Sold")
    def total_sold(self, obj):
        total = OrderItem.objects.filter(
            product=obj,
            order__status__in=["Confirmed", "Shipped", "Delivered"],
        ).aggregate(total=Sum("quantity"))["total"]
        return total or 0

    @admin.display(description="Inventory Status")
    def stock_status(self, obj):
        if obj.stock == 0:
            return "Out of stock"
        if obj.stock <= 5:
            return "Low stock"
        return "In stock"


class OrderItemInline(admin.TabularInline):
    model = OrderItem
    extra = 0
    can_delete = False
    readonly_fields = ("product", "quantity", "price")


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    
    def get_readonly_fields(self, request, obj=None):
        fields = list(super().get_readonly_fields(request, obj))

        # Cancelled order ko dobara active nahi kar sakte.
        if obj and obj.status == "Cancelled":
            if "status" not in fields:
                fields.append("status")

        return fields


    def save_model(self, request, obj, form, change):
        with transaction.atomic():
            previous_status = None

            if change:
                previous_status = (
                    Order.objects.select_for_update()
                    .get(pk=obj.pk)
                    .status
                )

            # Sirf pehli baar Cancelled hone par stock wapas karo.
            if (
                change
                and previous_status != "Cancelled"
                and obj.status == "Cancelled"
            ):
                for item in obj.items.all():
                    product = (
                        Product.objects.select_for_update()
                        .get(pk=item.product_id)
                    )

                    product.stock += item.quantity
                    product.save(update_fields=["stock"])

            super().save_model(request, obj, form, change)

        list_display = (
            "id",
            "customer_name",
            "phone",
            "total_amount",
            "status",
            "created_at",
        )

    list_filter = ("status", "created_at")
    search_fields = ("customer_name", "phone", "address")
    ordering = ("-created_at",)
    list_per_page = 20

    readonly_fields = (
        "customer_name",
        "phone",
        "address",
        "total_amount",
        "created_at",
    )

    inlines = [OrderItemInline]
