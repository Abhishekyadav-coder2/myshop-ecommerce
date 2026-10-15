
const products = [
    { id: 1, name: "Wireless Headphones", price: 1499 },
    { id: 2, name: "Classic Sneakers", price: 1999 },
    { id: 3, name: "Smart Watch", price: 2499 },
    { id: 4, name: "Everyday Backpack", price: 899 },
    { id: 5, name: "Minimal Sunglasses", price: 699 },
    { id: 6, name: "Everyday Bottle", price: 399 }
];

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

function formatPrice(amount) {
    return "₹" + amount.toLocaleString("en-IN");
}

function updateCart() {
    let quantity = 0;
    let total = 0;
    const itemDescriptions = [];

    for (const product of products) {
        const count = cart[product.id] || 0;

        quantity += count;
        total += product.price * count;

        if (count > 0) {
            itemDescriptions.push(
                `${product.name} × ${count}`
            );
        }
    }

    cartCount.textContent = quantity;
    cartSummary.hidden = false;

    if (quantity === 0) {
        cartMessage.textContent = "Your cart is empty.";
        cartItems.textContent = "Add a product to get started.";
    } else {
        cartMessage.textContent = `${quantity} item(s) in your cart`;
        cartItems.textContent = itemDescriptions.join(" • ");
    }

    cartTotal.textContent = formatPrice(total);
}

function showToast(message) {
    toast.textContent = message;
    toast.classList.add("show");

    setTimeout(() => {
        toast.classList.remove("show");
    }, 1800);
}

function addToCart(productId) {
    const product = products.find(
        item => item.id === productId
    );

    if (!product) {
        return;
    }

    cart[productId] = (cart[productId] || 0) + 1;

    updateCart();
    showToast(`${product.name} added to cart!`);
}

document.querySelectorAll("[data-add]").forEach(button => {
    button.addEventListener("click", () => {
        const productId = Number(button.dataset.add);
        addToCart(productId);
    });
});

function filterProducts() {
    const searchText = searchInput.value.toLowerCase().trim();
    let visibleCount = 0;

    document.querySelectorAll(".product-card").forEach(card => {
        const name = card.dataset.name.toLowerCase();
        const category = card.dataset.category;

        const matchesSearch = name.includes(searchText);
        const matchesCategory =
            selectedCategory === "All" ||
            category === selectedCategory;

        const visible = matchesSearch && matchesCategory;

        card.hidden = !visible;

        if (visible) {
            visibleCount++;
        }
    });

    productTotal.textContent = `${visibleCount} products`;
    emptyMessage.hidden = visibleCount !== 0;
}

searchInput.addEventListener("input", filterProducts);

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

document.getElementById("cartButton").addEventListener("click", () => {
    cartSummary.scrollIntoView({ behavior: "smooth", block: "center" });
});

document.getElementById("clearCart").addEventListener("click", () => {
    for (const id of Object.keys(cart)) {
        delete cart[id];
    }

    updateCart();
    showToast("Your cart has been cleared.");
});

updateCart();
filterProducts();
