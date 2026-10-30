/**
 * Krisin Clothing — Authentication & Session Management
 * Handles customer and admin authentication, JWT storage, and API synchronization.
 */

(function (window) {
  const CUSTOMER_TOKEN_KEY = "krisin_customer_token";
  const CUSTOMER_USER_KEY = "krisin_customer_user";

  const ADMIN_TOKEN_KEY = "krisin_admin_token";
  const ADMIN_SESSION_KEY = "krisin_admin_session";
  const ADMIN_EMAIL_KEY = "krisin_admin_email";

  const AUTH = {
    /**
     * Resolves backend API root.
     * When running directly from Express (port 4000), relative path "" is used.
     * When running via a separate static server (e.g. port 8000), targets https://krisin-clothing-1.onrender.com.
     */
    getApiBase() {
      if (typeof window === "undefined" || !window.location) return "";
      const { hostname, port } = window.location;
      if (port === "4000") return "";
      if (hostname === "localhost" || hostname === "127.0.0.1") {
        return "http://localhost:4000";
      }
      return "https://krisin-clothing-1.onrender.com";
    },

    /* =========================================================
       CUSTOMER AUTHENTICATION
       ========================================================= */

    getCustomerToken() {
      try {
        return localStorage.getItem(CUSTOMER_TOKEN_KEY) || "";
      } catch (e) {
        return "";
      }
    },

    getCustomer() {
      try {
        const raw = localStorage.getItem(CUSTOMER_USER_KEY);
        return raw ? JSON.parse(raw) : null;
      } catch (e) {
        return null;
      }
    },

    isCustomerLoggedIn() {
      return !!this.getCustomerToken() && !!this.getCustomer();
    },

    setCustomerSession(token, user) {
      try {
        localStorage.setItem(CUSTOMER_TOKEN_KEY, token);
        localStorage.setItem(CUSTOMER_USER_KEY, JSON.stringify(user));
      } catch (e) {}
      this.updateHeaderAuthUI();
      window.dispatchEvent(new CustomEvent("customer-session-changed"));
    },

    clearCustomerSession() {
      try {
        localStorage.removeItem(CUSTOMER_TOKEN_KEY);
        localStorage.removeItem(CUSTOMER_USER_KEY);
        localStorage.removeItem("krisin_orders_v1");
        localStorage.removeItem("kc_orders");
      } catch (e) {}
      this.updateHeaderAuthUI();
      window.dispatchEvent(new CustomEvent("customer-session-changed"));
    },

    customerLogout() {
      try {
        fetch(`${this.getApiBase()}/api/auth/logout`, { method: "POST" }).catch(() => {});
      } catch (e) {}
      this.clearCustomerSession();
      if (typeof window !== "undefined") {
        const path = (window.location.pathname || "").toLowerCase();
        if (path.includes("orders.html") || path.includes("profile.html")) {
          window.location.href = "login.html";
        } else {
          window.location.reload();
        }
      }
    },

    async customerLogin(email, password) {
      try {
        const res = await fetch(`${this.getApiBase()}/api/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password })
        });
        const data = await res.json();
        if (res.ok && data.token && data.user) {
          this.setCustomerSession(data.token, data.user);
          return { success: true, user: data.user, token: data.token };
        }
        return { success: false, error: data.error || "Incorrect email or password." };
      } catch (err) {
        console.error("customerLogin error:", err);
        return { success: false, error: "Unable to connect to the server. Please try again." };
      }
    },

    async customerRegister({ name, email, phone, password }) {
      try {
        const res = await fetch(`${this.getApiBase()}/api/auth/register`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, email, phone, password })
        });
        const data = await res.json();
        if (res.ok && data.token && data.user) {
          this.setCustomerSession(data.token, data.user);
          return { success: true, user: data.user, token: data.token };
        }
        return { success: false, error: data.error || "Unable to create account." };
      } catch (err) {
        console.error("customerRegister error:", err);
        return { success: false, error: "Unable to connect to the server. Please try again." };
      }
    },

    async verifyCustomer() {
      const token = this.getCustomerToken();
      if (!token) return false;
      try {
        const res = await fetch(`${this.getApiBase()}/api/auth/me`, {
          headers: { "Authorization": `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          if (data && data.user) {
            localStorage.setItem(CUSTOMER_USER_KEY, JSON.stringify(data.user));
            return true;
          }
        }
        if (res.status === 401 || res.status === 403) {
          this.clearCustomerSession();
          return false;
        }
      } catch (e) {}
      return !!this.getCustomer();
    },

    async saveOrder(orderData) {
      const token = this.getCustomerToken();
      if (!token) {
        throw new Error("Customer authentication required to place order.");
      }
      const res = await fetch(`${this.getApiBase()}/api/orders`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(orderData)
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Could not save order.");
      }
      return data;
    },

    async getMyOrders() {
      const token = this.getCustomerToken();
      if (!token) return { success: false, error: "Please sign in to view your orders." };
      try {
        const res = await fetch(`${this.getApiBase()}/api/orders/my-orders`, {
          headers: { "Authorization": `Bearer ${token}` }
        });
        const data = await res.json();
        if (res.ok) {
          return { success: true, orders: Array.isArray(data) ? data : [] };
        }
        return { success: false, error: data.error || "Failed to load orders." };
      } catch (err) {
        console.error("getMyOrders error:", err);
        return { success: false, error: "Unable to connect to order server." };
      }
    },

    async getOrderById(orderId) {
      const token = this.getCustomerToken();
      if (!token) return { success: false, error: "Please sign in to view this order." };
      try {
        const res = await fetch(`${this.getApiBase()}/api/orders/${encodeURIComponent(orderId)}`, {
          headers: { "Authorization": `Bearer ${token}` }
        });
        const data = await res.json();
        if (res.ok) {
          return { success: true, order: data };
        }
        return { success: false, error: data.error || "Order not found." };
      } catch (err) {
        console.error("getOrderById error:", err);
        return { success: false, error: "Unable to retrieve order details." };
      }
    },

    async cancelOrder(orderId, reason = "") {
      const token = this.getCustomerToken();
      if (!token) return { success: false, error: "Please sign in to cancel this order." };
      try {
        const res = await fetch(`${this.getApiBase()}/api/orders/${encodeURIComponent(orderId)}/cancel`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
          },
          body: JSON.stringify({ reason })
        });
        const data = await res.json();
        if (res.ok) {
          return { success: true, message: data.message, order: data.order };
        }
        return { success: false, error: data.error || "Failed to cancel order." };
      } catch (err) {
        console.error("cancelOrder error:", err);
        return { success: false, error: "Unable to cancel order. Please try again." };
      }
    },

    /* =========================================================
       ADMIN AUTHENTICATION & MANAGEMENT
       ========================================================= */

    getAdminToken() {
      try {
        return localStorage.getItem(ADMIN_TOKEN_KEY) || sessionStorage.getItem(ADMIN_TOKEN_KEY) || "";
      } catch (e) {
        return "";
      }
    },

    setAdminSession(token, email) {
      try {
        localStorage.setItem(ADMIN_TOKEN_KEY, token);
        sessionStorage.setItem(ADMIN_TOKEN_KEY, token);
        sessionStorage.setItem(ADMIN_SESSION_KEY, "1");
        localStorage.setItem(ADMIN_SESSION_KEY, "1");
        if (email) {
          localStorage.setItem(ADMIN_EMAIL_KEY, email);
          sessionStorage.setItem(ADMIN_EMAIL_KEY, email);
        }
      } catch (e) {}
    },

    adminClear() {
      try {
        localStorage.removeItem(ADMIN_TOKEN_KEY);
        sessionStorage.removeItem(ADMIN_TOKEN_KEY);
        sessionStorage.removeItem(ADMIN_SESSION_KEY);
        localStorage.removeItem(ADMIN_SESSION_KEY);
        sessionStorage.removeItem(ADMIN_EMAIL_KEY);
      } catch (e) {}
    },

    async adminLogin(email, password) {
      try {
        const res = await fetch(`${this.getApiBase()}/api/admin/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password })
        });
        const data = await res.json();
        if (res.ok && data.token) {
          this.setAdminSession(data.token, data.email || email);
          return { success: true, token: data.token };
        }
        return { success: false, error: data.error || "Invalid admin credentials." };
      } catch (err) {
        console.error("adminLogin error:", err);
        return { success: false, error: "Unable to connect to admin server." };
      }
    },

    async adminVerify() {
      const token = this.getAdminToken();
      if (!token) return false;
      try {
        const res = await fetch(`${this.getApiBase()}/api/admin/verify`, {
          headers: { "Authorization": `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          return !!data.valid;
        }
        if (res.status === 401 || res.status === 403) {
          return false;
        }
      } catch (e) {}
      // If network temporarily unavailable, preserve local session
      return true;
    },

    adminLogout() {
      try {
        fetch(`${this.getApiBase()}/api/admin/logout`, { method: "POST" }).catch(() => {});
      } catch (e) {}
      this.adminClear();
      window.location.href = "login.html";
    },

    /* =========================================================
       UI HELPERS FOR NAVBAR
       ========================================================= */

    updateHeaderAuthUI() {
      const isCustomer = this.isCustomerLoggedIn();
      const customer = isCustomer ? this.getCustomer() : null;

      // Update account icon buttons on customer pages
      document.querySelectorAll('a[aria-label="Account"]').forEach(el => {
        // Don't wrap if already wrapped
        if (el.parentElement && el.parentElement.classList.contains('header-account-wrap')) {
          // Just update the existing dropdown
          const existingDropdown = el.parentElement.querySelector('.user-dropdown');
          if (existingDropdown) existingDropdown.remove();

          if (isCustomer && customer) {
            el.setAttribute("title", `Signed in as ${customer.name}`);
            el.removeAttribute("href");
            el.style.cursor = "pointer";
            const dropdown = AUTH._createUserDropdown(customer);
            el.parentElement.appendChild(dropdown);
            el.onclick = (e) => {
              e.preventDefault();
              e.stopPropagation();
              dropdown.classList.toggle('open');
            };
          } else {
            el.setAttribute("title", "Sign in");
            el.setAttribute("href", "login.html");
            el.style.cursor = "";
            el.onclick = null;
          }
          return;
        }

        // Wrap icon in a container for dropdown positioning
        const wrapper = document.createElement('div');
        wrapper.className = 'header-account-wrap';
        el.parentNode.insertBefore(wrapper, el);
        wrapper.appendChild(el);

        if (isCustomer && customer) {
          el.setAttribute("title", `Signed in as ${customer.name}`);
          el.removeAttribute("href");
          el.style.cursor = "pointer";
          const dropdown = AUTH._createUserDropdown(customer);
          wrapper.appendChild(dropdown);
          el.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropdown.classList.toggle('open');
          };
        } else {
          el.setAttribute("title", "Sign in");
          el.setAttribute("href", "login.html");
          el.style.cursor = "";
          el.onclick = null;
        }
      });

      // Update desktop main navigation bar
      const isOrdersPage = (typeof window !== "undefined" && window.location.pathname) 
        ? window.location.pathname.toLowerCase().endsWith("orders.html") 
        : false;
      const isCustomisePage = (typeof window !== "undefined" && window.location.pathname) 
        ? window.location.pathname.toLowerCase().endsWith("customise.html") 
        : false;

      document.querySelectorAll(".main-nav").forEach(nav => {
        const navCustomise = nav.querySelector('a[href="customise.html"]');
        if (navCustomise) {
          if (isCustomisePage) {
            navCustomise.classList.add("active");
          } else {
            navCustomise.classList.remove("active");
          }
        }

        let navOrders = nav.querySelector(".nav-my-orders-item");
        if (isCustomer && customer) {
          if (!navOrders) {
            navOrders = document.createElement("a");
            navOrders.className = "nav-my-orders-item";
            navOrders.href = "orders.html";
            navOrders.textContent = "My Orders";
            nav.appendChild(navOrders);
          }
          if (isOrdersPage) {
            navOrders.classList.add("active");
          } else {
            navOrders.classList.remove("active");
          }
        } else {
          if (navOrders) navOrders.remove();
        }
      });

      // Update mobile navigation links (cleanly, with Customise beside My Orders)
      document.querySelectorAll(".mobile-nav-links").forEach(mobileNav => {
        const mobileCustomise = mobileNav.querySelector('a[href="customise.html"]');
        if (mobileCustomise) {
          if (isCustomisePage) {
            mobileCustomise.classList.add("active");
          } else {
            mobileCustomise.classList.remove("active");
          }
        }

        let mobileOrders = mobileNav.querySelector(".mobile-my-orders-item");
        if (isCustomer && customer) {
          if (!mobileOrders) {
            mobileOrders = document.createElement("a");
            mobileOrders.className = "mobile-my-orders-item";
            mobileOrders.href = "orders.html";
            mobileOrders.textContent = "My Orders";
            mobileNav.appendChild(mobileOrders);
          }
          if (isOrdersPage) {
            mobileOrders.classList.add("active");
          } else {
            mobileOrders.classList.remove("active");
          }
        } else {
          if (mobileOrders) mobileOrders.remove();
        }
      });

      // Update mobile nav drawer account card
      document.querySelectorAll(".mobile-nav").forEach(drawer => {
        let accountBox = drawer.querySelector(".mobile-nav-account");
        if (!accountBox) {
          accountBox = document.createElement("div");
          accountBox.className = "mobile-nav-account";
          const linksNav = drawer.querySelector(".mobile-nav-links");
          if (linksNav) {
            linksNav.after(accountBox);
          } else {
            drawer.appendChild(accountBox);
          }
        }

        if (isCustomer && customer) {
          const firstName = (customer.name || "Customer").split(" ")[0];
          const initial = firstName.charAt(0).toUpperCase();
          accountBox.innerHTML = `
            <div class="mobile-user-card">
              <div class="mobile-user-header">
                <span class="mobile-user-avatar">${initial}</span>
                <span>Hello, ${this._escapeHtml(firstName)}</span>
              </div>
              <div class="mobile-user-actions">
                <a href="shop.html?filter=wishlist" class="mobile-user-action">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 21s-7.5-4.6-10-9.2C.4 8.4 2 4.5 6 4c2.4-.3 4.2 1 6 3 1.8-2 3.6-3.3 6-3 4 .5 5.6 4.4 4 7.8C19.5 16.4 12 21 12 21z"/></svg>
                  <span>Wishlist</span>
                </a>
                <a href="cart.html" class="mobile-user-action">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 8h12l-1 12H7L6 8z"/><path d="M9 8V6a3 3 0 016 0v2"/></svg>
                  <span>Bag</span>
                </a>
              </div>
              <button class="btn btn-outline btn-block" id="mobile-signout-btn" style="font-size:12px; padding:7px 10px; margin-top:2px;">Sign Out</button>
            </div>
          `;
          const signoutBtn = accountBox.querySelector("#mobile-signout-btn");
          if (signoutBtn) {
            signoutBtn.onclick = (e) => {
              e.preventDefault();
              if (confirm("Do you want to sign out?")) {
                AUTH.customerLogout();
              }
            };
          }
        } else {
          accountBox.innerHTML = `
            <div class="mobile-guest-card">
              <p>Sign in to access your orders and wishlist</p>
              <a href="login.html" class="btn btn-primary btn-block">Sign In / Register</a>
              <div class="mobile-guest-links">
                <a href="shop.html?filter=wishlist">♡ Wishlist</a>
                <a href="cart.html">🛍️ Bag</a>
              </div>
            </div>
          `;
        }
      });

      // Update mobile-nav-foot with brand motto & support info instead of raw squished links
      const mobileNavFoot = document.querySelector(".mobile-nav-foot");
      if (mobileNavFoot) {
        mobileNavFoot.innerHTML = `
          <span class="foot-tagline">KRISIN — Everyday Essentials</span>
          <span>Designed with intention in Tamil Nadu</span>
          <span style="opacity:0.75">Need help? care@krisinclothing.com</span>
        `;
      }
    },

    _createUserDropdown(customer) {
      const dropdown = document.createElement('div');
      dropdown.className = 'user-dropdown';
      const initials = (customer.name || '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
      dropdown.innerHTML = `
        <div class="user-dropdown-header">
          <div class="user-name">${this._escapeHtml(customer.name)}</div>
          <div class="user-email">${this._escapeHtml(customer.email)}</div>
        </div>
        <div class="user-dropdown-links">
          <a href="profile.html">
            <svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 5-6 8-6s6.5 2 8 6"/></svg>
            My Account
          </a>
          <a href="orders.html">
            <svg viewBox="0 0 24 24"><path d="M6 2l1.5 4h9L18 2"/><rect x="4" y="6" width="16" height="15" rx="1"/><path d="M10 10h4M10 14h4"/></svg>
            My Orders
          </a>
          <a href="customise.html">
            <svg viewBox="0 0 24 24"><path d="M12 2l4 3 4-1-2 5 2 2-3 2v8H7v-8l-3-2 2-2-2-5 4 1 4-3z" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="11" r="2"/></svg>
            Customise Clothing
          </a>
          <div class="dropdown-divider"></div>
          <button class="logout-link" id="dropdown-logout-btn">
            <svg viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            Sign Out
          </button>
        </div>
      `;

      // Attach logout handler
      const logoutBtn = dropdown.querySelector('#dropdown-logout-btn');
      if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          if (confirm('Do you want to sign out?')) {
            AUTH.customerLogout();
          }
        });
      }

      return dropdown;
    },

    _escapeHtml(str) {
      const div = document.createElement('div');
      div.textContent = str || '';
      return div.innerHTML;
    }
  };

  window.AUTH = AUTH;

  // Background customer verification on page load
  if (typeof document !== "undefined") {
    document.addEventListener("DOMContentLoaded", () => {
      AUTH.updateHeaderAuthUI();
      if (AUTH.isCustomerLoggedIn()) {
        AUTH.verifyCustomer().then(valid => {
          if (!valid) AUTH.updateHeaderAuthUI();
        });
      }

      // Close dropdown when clicking outside
      document.addEventListener('click', (e) => {
        document.querySelectorAll('.user-dropdown.open').forEach(dd => {
          if (!dd.contains(e.target) && !dd.previousElementSibling?.contains(e.target)) {
            dd.classList.remove('open');
          }
        });
      });
    });
  }
})(window);
