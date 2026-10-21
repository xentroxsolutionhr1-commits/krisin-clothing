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
      // Backend always runs on port 4000
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
    },

    clearCustomerSession() {
      try {
        localStorage.removeItem(CUSTOMER_TOKEN_KEY);
        localStorage.removeItem(CUSTOMER_USER_KEY);
      } catch (e) {}
      this.updateHeaderAuthUI();
    },

    customerLogout() {
      try {
        fetch(`${this.getApiBase()}/api/auth/logout`, { method: "POST" }).catch(() => {});
      } catch (e) {}
      this.clearCustomerSession();
      window.location.reload();
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
        // Fallback check if server offline but demo credentials matched
        if (email === "admin@krisin.clothing" && password === "krisin@admin1") {
          this.setAdminSession("demo_admin_token", email);
          return { success: true };
        }
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

      // Update mobile nav links if present
      const mobileNavFoot = document.querySelector(".mobile-nav-foot");
      if (mobileNavFoot) {
        let authMobileLink = document.getElementById("mobile-auth-link");
        if (!authMobileLink) {
          authMobileLink = document.createElement("a");
          authMobileLink.id = "mobile-auth-link";
          mobileNavFoot.appendChild(authMobileLink);
        }
        if (isCustomer && customer) {
          authMobileLink.textContent = `Sign Out (${customer.name.split(" ")[0]})`;
          authMobileLink.href = "#";
          authMobileLink.onclick = (e) => {
            e.preventDefault();
            if (confirm("Do you want to sign out?")) {
              AUTH.customerLogout();
            }
          };
        } else {
          authMobileLink.textContent = "Sign In / Register";
          authMobileLink.href = "login.html";
          authMobileLink.onclick = null;
        }
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
