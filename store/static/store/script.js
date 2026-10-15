
const productCards = [...document.querySelectorAll(".product-card")];

const products = productCards.map(card => ({
    id: Number(card.dataset.id),
    name: card.dataset.name,
    category: card.dataset.category,
    price: Number(card.dataset.price)
}));

const detailAddButton = document.getElementById("detailAddToCart");

if (detailAddButton) {
    const productId = Number(detailAddButton.dataset.add);
    const detailName =
        document.querySelector(".product-detail-info h1")?.textContent.trim() || "Product";
    const detailCategory =
        document.querySelector(".product-detail-info .product-category")?.textContent.trim() || "";
    const detailPriceText =
        document.querySelector(".detail-price")?.textContent || "0";
    const detailPrice =
        Number(detailPriceText.replace(/[₹,\s]/g, "")) || 0;

    if (!products.some(product => product.id === productId)) {
        products.push({
            id: productId,
            name: detailName,
            category: detailCategory,
            price: detailPrice
        });
    }
}

const cart = {};

const searchInput = document.getElementById("searchInput");
const cartCount = document.getElementById("cartCount");
const cartSummary = document.getElementById("cartSummary");
const cartMessage = document.getElementById("cartMessage");
const cartItems = document.getElementById("cartItems");
const cartTotal = document.getElementById("cartTotal");
const productTotal = document.getElementById("productTotal");
const emptyMessage = document.getElementById("emptyMessage");
const toast = document.getElementById("toast");

let selectedCategory = "All";
let cartReady = false;
let requestQueue = Promise.resolve();

function formatPrice(amount) {
    return "₹" + amount.toLocaleString("en-IN", {
        maximumFractionDigits: 2
    });
}

function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, character => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[character]);
}

function getCookie(name) {
    const cookie = document.cookie
        .split("; ")
        .find(row => row.startsWith(name + "="));

    return cookie
        ? decodeURIComponent(cookie.split("=").slice(1).join("="))
        : "";
}

function setCart(serverCart) {
    for (const id of Object.keys(cart)) {
        delete cart[id];
    }

    for (const [id, quantity] of Object.entries(serverCart)) {
        cart[Number(id)] = Number(quantity);
    }
}

async function loadCartFromServer() {
    try {
        const response = await fetch("/cart/update/");
        console.log("Cart API status:", response.status);
        const data = await response.json();
        console.log("Cart API response:", data);

        if (!response.ok) {
            throw new Error(data.error || "Could not load cart.");
        }

        setCart(data.cart || {});
        cartReady = true;
        updateCart();
    } catch (error) {
        console.error("Cart loading error:", error);
        showToast("Could not load your cart. Refresh the page.");
    }
}

function syncQuantity(productId, quantity) {
    // Process requests in order so rapid clicks do not overwrite each other.
    requestQueue = requestQueue.then(async () => {
        const response = await fetch("/cart/update/", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-CSRFToken": getCookie("csrftoken")
            },
            body: JSON.stringify({
                product_id: productId,
                quantity: quantity
            })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || "Cart update failed.");
        }
    }).catch(async error => {
        showToast(error.message || "Could not update cart.");
        await loadCartFromServer();
    });

    return requestQueue;
}


function updateCart() {
    let quantity = 0;
    let total = 0;
    const items = [];

    for (const product of products) {
        const count = cart[product.id] || 0;

        quantity += count;
        total += product.price * count;

        if (count > 0) {
            items.push(`
                <div class="cart-item">
                    <div class="cart-item-details">
                        <strong>${escapeHTML(product.name)}</strong>
                        <span>${formatPrice(product.price)} each</span>
                    </div>

                    <div class="cart-item-actions">
                        <div class="quantity-control">
                            <button class="quantity-button"
                                    data-change="-1"
                                    data-id="${product.id}">−</button>

                            <span class="quantity-number">${count}</span>

                            <button class="quantity-button"
                                    data-change="1"
                                    data-id="${product.id}">+</button>
                        </div>

                        <button class="remove-item"
                                data-remove="${product.id}">
                            Remove
                        </button>

                        <strong class="item-total">
                            ${formatPrice(product.price * count)}
                        </strong>
                    </div>
                </div>
            `);
        }
    }

    if (cartCount) {
        cartCount.textContent = quantity;
    }

    if (cartSummary) {
        cartSummary.hidden = false;
    }

    if (cartMessage) {
        cartMessage.textContent = quantity === 0
            ? "Your cart is empty."
            : `${quantity} item(s) in your cart`;
    }

    if (cartItems) {
        cartItems.innerHTML = quantity === 0
            ? '<p class="cart-empty">Add a product to get started.</p>'
            : items.join("") + `
                <a href="/checkout/" class="add-button"
                   style="display:inline-block; text-align:center; text-decoration:none;">
                    Proceed to Checkout
                </a>
            `;
    }

    if (cartTotal) {
        cartTotal.textContent = formatPrice(total);
    }
}

function showToast(message) {
    toast.textContent = message;
    toast.classList.add("show");

    setTimeout(() => {
        toast.classList.remove("show");
    }, 1800);
}


function addToCart(productId, quantityToAdd = 1) {
    if (!cartReady) {
        showToast("Please wait. Cart is loading.");
        return;
    }

    const product = products.find(item => item.id === productId);

    if (!product) {
        showToast("Product not found.");
        return;
    }

    const quantity = Number(quantityToAdd);

    if (!Number.isInteger(quantity) || quantity < 1) {
        showToast("Please enter a valid quantity.");
        return;
    }

    cart[productId] = (cart[productId] || 0) + quantity;

    updateCart();

    syncQuantity(productId, cart[productId]);

    showToast(`${product.name} added to cart!`);
}


document.querySelectorAll("[data-add]").forEach(button => {
    button.addEventListener("click", () => {
        const isDetailPage = button.id === "detailAddToCart";
        const quantityInput = document.getElementById("detailQuantity");

        const quantityToAdd =
            isDetailPage && quantityInput
                ? Number(quantityInput.value)
                : 1;

        if (isDetailPage && quantityInput) {
            const maxQuantity = Number(quantityInput.max);

            if (
                !Number.isInteger(quantityToAdd) ||
                quantityToAdd < 1 ||
                quantityToAdd > maxQuantity
            ) {
                showToast(`Choose a quantity between 1 and ${maxQuantity}.`);
                return;
            }
        }

        addToCart(Number(button.dataset.add), quantityToAdd);
    });
});

if (cartItems) {
    cartItems.addEventListener("click", event => {
        const quantityButton = event.target.closest("[data-change]");
        const removeButton = event.target.closest("[data-remove]");

        if (!cartReady) return;

        if (quantityButton) {
            const id = Number(quantityButton.dataset.id);
            const change = Number(quantityButton.dataset.change);

            if (!cart[id]) return;

            const newQuantity = cart[id] + change;

            if (newQuantity <= 0) {
                delete cart[id];
            } else {
                cart[id] = newQuantity;
            }

            updateCart();
            syncQuantity(id, Math.max(0, newQuantity));
            return;
        }

        if (removeButton) {
            const id = Number(removeButton.dataset.remove);

            delete cart[id];
            updateCart();
            syncQuantity(id, 0);

            showToast("Product removed from cart.");
        }
    });
}
function filterProducts() {
    if (!searchInput || !productTotal || !emptyMessage) return;
    const searchText = searchInput.value.toLowerCase().trim();
    let visibleCount = 0;

    productCards.forEach(card => {
        const name = card.dataset.name.toLowerCase();
        const category = card.dataset.category;

        const matchesSearch = name.includes(searchText);
        const matchesCategory =
            selectedCategory === "All" ||
            category === selectedCategory;

        const visible = matchesSearch && matchesCategory;
        card.hidden = !visible;

        if (visible) visibleCount++;
    });

    productTotal.textContent = `${visibleCount} products`;
    emptyMessage.hidden = visibleCount !== 0;
}

if (searchInput) {
    searchInput.addEventListener("input", filterProducts);
}

document.querySelectorAll(".category").forEach(button => {
    button.addEventListener("click", () => {
        selectedCategory = button.dataset.category;

        document.querySelectorAll(".category").forEach(item => {
            item.classList.remove("active");
        });

        button.classList.add("active");
        filterProducts();
    });
});



const cartButton = document.getElementById("cartButton");

if (cartButton) {
    cartButton.addEventListener("click", () => {
        if (cartSummary) {
            cartSummary.hidden = false;

            cartSummary.scrollIntoView({
                behavior: "smooth",
                block: "center"
            });
        } else {
            window.location.href = "/?showCart=1#cartSummary";
        }
    });
}


const clearCartButton = document.getElementById("clearCart");

if (clearCartButton) {
    clearCartButton.addEventListener("click", () => {
        if (!cartReady) return;

        const ids = Object.keys(cart).map(Number);

        for (const id of ids) {
            delete cart[id];
        }

        updateCart();

        for (const id of ids) {
            syncQuantity(id, 0);
        }

        showToast("Your cart has been cleared.");
    });
}
filterProducts();
loadCartFromServer();

