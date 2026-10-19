/* =========================================================
   KRISIN CLOTHING — API Client (Neon PostgreSQL Backend)
   
   Connects storefront and admin UI to the Express + Neon Postgres
   backend when running on http://localhost:4000. Falls back
   gracefully to static js/data.js and localStorage if backend
   is not running or database is not yet initialized.
   ========================================================= */

const API_BASE = "https://krisin-clothing.onrender.com/api";

const KrisinAPI = {
  isBackendAvailable: null,

async checkHealth() {
  try {
    const res = await fetch(`${API_BASE}/health`, {
      signal: AbortSignal.timeout(10000)
    });

    if (!res.ok) {
      this.isBackendAvailable = false;
      return { online: false };
    }

    const data = await res.json();

    this.isBackendAvailable = Boolean(
      data.database && data.database.connected
    );

    return {
      ...data,
      online: true
    };
  } catch (error) {
    this.isBackendAvailable = false;
    console.error("Health check failed:", error);
    return { online: false };
  }
},

  async syncCatalogue() {
    try {
      const health = await this.checkHealth();
      if (health.online && health.database && health.database.connected) {
        const liveProducts = await this.getProducts();
        if (Array.isArray(liveProducts) && liveProducts.length) {
          window.PRODUCTS = liveProducts;
          return liveProducts;
        }
      }
    } catch (e) {
      console.warn("Neon DB sync note:", e);
    }
    return typeof PRODUCTS !== "undefined" ? PRODUCTS : [];
  },

  // ---------------------------------------------------------
  // Products
  // ---------------------------------------------------------
  async getProducts(params = {}) {
    const qs = new URLSearchParams();
    if (params.category && params.category !== "All") qs.append("category", params.category);
    if (params.search) qs.append("search", params.search);
    if (params.sort) qs.append("sort", params.sort);

    try {
      const res = await fetch(`${API_BASE}/products?${qs.toString()}`, { signal: AbortSignal.timeout(3000) });
      if (!res.ok) throw new Error("Backend response error");
      return await res.json();
    } catch {
      // Fallback to local data
      let list = typeof getAllProducts === "function" ? getAllProducts() : (typeof PRODUCTS !== "undefined" ? PRODUCTS : []);
      if (params.category && params.category !== "All") {
        list = list.filter(p => p.category === params.category);
      }
      if (params.search) {
        const q = params.search.toLowerCase();
        list = list.filter(p => p.name.toLowerCase().includes(q) || (p.description && p.description.toLowerCase().includes(q)));
      }
      return list;
    }
  },

  async getProduct(id) {
    try {
      const res = await fetch(`${API_BASE}/products/${id}`, { signal: AbortSignal.timeout(3000) });
      if (!res.ok) throw new Error("Product not found");
      return await res.json();
    } catch {
      return typeof getProduct === "function" ? getProduct(id) : null;
    }
  },

  async createProduct(product) {
    const res = await fetch(`${API_BASE}/products`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(product),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "Failed to create product");
    }
    return await res.json();
  },

  async updateProduct(id, product) {
    const res = await fetch(`${API_BASE}/products/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(product),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "Failed to update product");
    }
    return await res.json();
  },

  async deleteProduct(id) {
    const res = await fetch(`${API_BASE}/products/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "Failed to delete product");
    }
    return await res.json();
  },

  // ---------------------------------------------------------
  // Categories
  // ---------------------------------------------------------
  async getCategories() {
    try {
      const res = await fetch(`${API_BASE}/categories`, { signal: AbortSignal.timeout(3000) });
      if (!res.ok) throw new Error("Failed");
      return await res.json();
    } catch {
      return typeof CATEGORIES !== "undefined" ? CATEGORIES.map(c => ({ name: c, count: 0 })) : [];
    }
  },

  // ---------------------------------------------------------
  // Admin Auth
  // ---------------------------------------------------------
  async adminLogin(email, password) {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || "Invalid credentials");
    }
    return await res.json();
  },

  // ---------------------------------------------------------
  // Orders
  // ---------------------------------------------------------
  async getOrders() {
    const res = await fetch(`${API_BASE}/orders`, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) throw new Error("Failed to fetch orders");
    return await res.json();
  },

  async createOrder(orderData) {
    const res = await fetch(`${API_BASE}/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(orderData),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "Failed to place order");
    }
    return await res.json();
  },

  async updateOrderStatus(id, status) {
    const res = await fetch(`${API_BASE}/orders/${id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    return await res.json();
  },

  // ---------------------------------------------------------
  // Customers & Access Control
  // ---------------------------------------------------------
  async getCustomers() {
    const res = await fetch(`${API_BASE}/customers`, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) throw new Error("Failed to fetch customers");
    return await res.json();
  },

  async updateCustomerStatus(email, status) {
    const res = await fetch(`${API_BASE}/customers/${encodeURIComponent(email)}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    return await res.json();
  },

  async checkCustomerStatus(email) {
    try {
      const res = await fetch(`${API_BASE}/customers/check-status?email=${encodeURIComponent(email)}`, { signal: AbortSignal.timeout(2000) });
      if (!res.ok) return { allowed: true };
      return await res.json();
    } catch {
      return { allowed: true };
    }
  },

  // ---------------------------------------------------------
  // Coupons & Reviews
  // ---------------------------------------------------------
  async getCoupons() {
    const res = await fetch(`${API_BASE}/coupons`);
    if (!res.ok) throw new Error("Failed to fetch coupons");
    return await res.json();
  },

  async applyCoupon(code, cartTotal) {
    const res = await fetch(`${API_BASE}/coupons/apply`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, cartTotal }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Invalid coupon");
    return data;
  },

  async getReviews(productId) {
    const qs = productId ? `?productId=${productId}` : "";
    const res = await fetch(`${API_BASE}/reviews${qs}`);
    if (!res.ok) throw new Error("Failed to fetch reviews");
    return await res.json();
  },

  async updateReviewStatus(id, status) {
    const res = await fetch(`${API_BASE}/reviews/${id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    return await res.json();
  },

  // ---------------------------------------------------------
  // Dashboard Metrics
  // ---------------------------------------------------------
  async getDashboardStats() {
    const res = await fetch(`${API_BASE}/admin/stats`, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) throw new Error("Failed to fetch stats");
    return await res.json();
  }
};

window.KrisinAPI = KrisinAPI;
