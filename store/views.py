
from django.contrib.admin.views.decorators import staff_member_required
from django.db.models import Sum, Q, Value, Count, F
from django.db.models.functions import Coalesce
from decimal import Decimal
from django.utils import timezone

from django.shortcuts import render, redirect, get_object_or_404
from django.contrib import messages
from django.db import transaction

from .models import Product, Order, OrderItem
from django.http import JsonResponse
from django.views.decorators.http import require_http_methods
from django.views.decorators.csrf import ensure_csrf_cookie
import json
import re
@ensure_csrf_cookie
def home(request):
    products = Product.objects.filter(is_available=True)
    return render(request, "store/index.html", {
        "products": products
    })

def product_detail(request, product_id):
    product = get_object_or_404(
        Product,
        id=product_id,
        is_available=True
    )

    return render(request, "store/product_detail.html", {
        "product": product
    })


def checkout(request):
    cart = request.session.get("cart", {})

    if not cart:
        messages.error(request, "Your cart is empty.")
        return redirect("home")

    if request.method == "POST":
        customer_name = request.POST.get("customer_name", "").strip()
        phone = request.POST.get("phone", "").strip()
        address = request.POST.get("address", "").strip()
        


        # Inside checkout(), after reading the three form fields:

        customer_name = " ".join(customer_name.split())
        address = " ".join(address.split())

        # Name: maximum 50 characters; letters, spaces,
        # hyphens and apostrophes are allowed.
        valid_name = (
            1 <= len(customer_name) <= 50
            and all(
                char.isalpha() or char in " '-"
                for char in customer_name
            )
        )

        if not valid_name:
            messages.error(
                request,
                "Name must contain only letters, spaces, hyphens or apostrophes (max 50 characters)."
            )
            return redirect("checkout")

        # Indian mobile number: exactly 10 digits, starting 6–9.
        if not re.fullmatch(r"[6-9][0-9]{9}", phone):
            messages.error(
                request,
                "Enter a valid 10-digit Indian mobile number."
            )
            return redirect("checkout")

        # Address: basic text validation.
        if (
            len(address) < 10
            or len(address) > 300
            or not any(char.isalpha() for char in address)
        ):
            messages.error(
                request,
                "Enter a complete address between 10 and 300 characters."
            )
            return redirect("checkout")

        if not customer_name or not phone or not address:
            messages.error(request, "Please fill in all fields.")
            return redirect("checkout")

        if len(phone) > 15:
            messages.error(request, "Phone number is too long.")
            return redirect("checkout")

        try:
            with transaction.atomic():
                products = Product.objects.select_for_update().filter(
                    id__in=cart.keys(),
                    is_available=True
                )
                product_map = {str(p.id): p for p in products}

                validated_items = []
                total = Decimal("0.00")

                for product_id, quantity in cart.items():
                    product = product_map.get(str(product_id))

                    if not product:
                        raise ValueError(
                            "A product is no longer available."
                        )

                    try:
                        quantity = int(quantity)
                    except (TypeError, ValueError):
                        raise ValueError("Invalid cart quantity.")

                    if quantity < 1:
                        raise ValueError("Invalid cart quantity.")

                    if quantity > product.stock:
                        raise ValueError(
                            f"Not enough stock for {product.name}."
                        )

                    total += product.price * quantity
                    validated_items.append((product, quantity))

                order = Order.objects.create(
                    customer_name=customer_name,
                    phone=phone,
                    address=address,
                    total_amount=total
                )

                for product, quantity in validated_items:
                    OrderItem.objects.create(
                        order=order,
                        product=product,
                        quantity=quantity,
                        price=product.price
                    )

                    product.stock -= quantity
                    product.save(update_fields=["stock"])

            request.session["cart"] = {}
            request.session.modified = True

            return render(request, "store/order_success.html", {
                "order": order
            })

        except ValueError as error:
            messages.error(request, str(error))
            return redirect("checkout")

    return render(request, "store/checkout.html")

import json

from django.http import JsonResponse
from django.views.decorators.http import require_POST



@require_http_methods(["GET", "POST"])
def cart_api(request):
    cart = request.session.get("cart", {})

    if request.method == "GET":
        return JsonResponse({"cart": cart})

    try:
        data = json.loads(request.body)
        product_id = int(data.get("product_id", 0))
        quantity = int(data.get("quantity", -1))
    except (ValueError, TypeError, json.JSONDecodeError):
        return JsonResponse(
            {"error": "Invalid request."},
            status=400
        )

    if product_id <= 0 or quantity < 0:
        return JsonResponse(
            {"error": "Invalid product or quantity."},
            status=400
        )

    key = str(product_id)

    # Allow removal even if the product is no longer available.
    if quantity == 0:
        cart.pop(key, None)
    else:
        try:
            product = Product.objects.get(
                id=product_id,
                is_available=True
            )
        except Product.DoesNotExist:
            return JsonResponse(
                {"error": "Product not found."},
                status=404
            )

        if quantity > product.stock:
            return JsonResponse(
                {"error": f"Only {product.stock} unit(s) in stock."},
                status=400
            )

        cart[key] = quantity

    request.session["cart"] = cart
    request.session.modified = True

    return JsonResponse({"cart": cart})

@staff_member_required(login_url="/admin/login/")
def inventory_dashboard(request):
    products = Product.objects.annotate(
        sold_units=Coalesce(
            Sum(
                "orderitem__quantity",
                filter=Q(
                    orderitem__order__status__in=[
                        "Confirmed",
                        "Shipped",
                        "Delivered",
                    ]
                ),
            ),
            Value(0),
        )
    ).order_by("stock", "name")

    total_products = Product.objects.count()

    total_stock = Product.objects.aggregate(
        total=Sum("stock")
    )["total"] or 0

    low_stock_count = Product.objects.filter(
        stock__lte=5
    ).count()

    sold_units = OrderItem.objects.filter(
        order__status__in=["Confirmed", "Shipped", "Delivered"]
    ).aggregate(total=Sum("quantity"))["total"] or 0

    sales_total = Order.objects.filter(
        status__in=["Confirmed", "Shipped", "Delivered"]
    ).aggregate(total=Sum("total_amount"))["total"] or 0

    context = {
        "products": products,
        "total_products": total_products,
        "total_stock": total_stock,
        "low_stock_count": low_stock_count,
        "sold_units": sold_units,
        "sales_total": sales_total,
    }

    return render(request, "store/inventory.html", context)

@require_http_methods(["GET", "POST"])
def track_order(request):
    order = None
    error = None

    if request.method == "POST":
        order_id = request.POST.get("order_id", "").strip()
        phone = request.POST.get("phone", "").strip()

        try:
            order_id = int(order_id)
            if order_id <= 0:
                raise ValueError
        except (ValueError, TypeError):
            order_id = None

        if order_id is None or not phone:
            error = "Enter a valid Order ID and phone number."
        else:
            order = (
                Order.objects
                .filter(pk=order_id, phone=phone)
                .prefetch_related("items__product")
                .first()
            )

            if order is None:
                error = (
                    "Order not found. Check your Order ID "
                    "and phone number."
                )

    return render(
        request,
        "store/track_order.html",
        {"order": order, "error": error},
    )
@staff_member_required(login_url="/admin/login/")
def sales_report(request):
    today = timezone.localdate()

    valid_statuses = ["Confirmed", "Shipped", "Delivered"]

    completed_orders = Order.objects.filter(
        status__in=valid_statuses
    )

    total_orders = completed_orders.count()

    total_sales = completed_orders.aggregate(
        total=Coalesce(
            Sum("total_amount"),
            Decimal("0.00")
        )
    )["total"]

    today_orders = completed_orders.filter(
        created_at__date=today
    )

    today_sales = today_orders.aggregate(
        total=Coalesce(
            Sum("total_amount"),
            Decimal("0.00")
        )
    )["total"]

    top_products = (
        OrderItem.objects
        .filter(order__status__in=valid_statuses)
        .values("product__name")
        .annotate(
            units_sold=Sum("quantity"),
            revenue=Sum(F("price") * F("quantity"))
        )
        .order_by("-units_sold")[:5]
    )
    context = {
        "total_orders": total_orders,
        "total_sales": total_sales,
        "today_orders": today_orders.count(),
        "today_sales": today_sales,
        "top_products": top_products,
    }

    return render(request, "store/sales_report.html", context)