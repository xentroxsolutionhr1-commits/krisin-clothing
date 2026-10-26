/**
 * Krisin Clothing — Backend Server
 * 
 * Powered by:
 * - Express & CORS
 * - bcryptjs for secure password hashing
 * - jsonwebtoken (JWT) for standard signed token generation and verification
 * - SQLite database (native node:sqlite) for customer accounts, orders & sessions
 * - Razorpay order creation and payment verification
 */

require("dotenv").config();
const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
const path = require("path");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { DatabaseSync } = require("node:sqlite");
const Razorpay = require("razorpay");

const app = express();
app.use(cors());
app.use(express.json());

const JWT_SECRET = process.env.JWT_SECRET || "krisin_jwt_secret_key_2026_super_secure";

// Serve static root path
const staticRoot = path.join(__dirname, "..");


/* Restrict admin pages and APIs to approved public IP addresses */
app.set("trust proxy", 3);

const normalizeIp = (ip = "") =>
  ip.startsWith("::ffff:") ? ip.slice(7) : ip;

const allowedAdminIps = (process.env.ADMIN_ALLOWED_IPS || "")
  .split(",")
  .map((ip) => normalizeIp(ip.trim()))
  .filter(Boolean);

app.use((req, res, next) => {
  const isAdminPath =
    req.path === "/admin" ||
    req.path.startsWith("/admin/") ||
    req.path === "/admin05" ||
    req.path.startsWith("/admin05/") ||
    req.path === "/api/admin" ||
    req.path.startsWith("/api/admin/");

  if (!isAdminPath) {
    return next();
  }

  if (allowedAdminIps.length === 0) {
    return res.status(503).send(
      "Admin access is not configured. Contact the site administrator."
    );
  }

  const clientIp = normalizeIp(req.ip || "");

  if (!allowedAdminIps.includes(clientIp)) {
    return res.status(403).send("Access denied: IP address not allowed.");
  }

  next();
});

/* New admin URLs */
app.get(["/admin05/login", "/admin05/login/"], (req, res) => {
  res.sendFile(path.join(staticRoot, "admin", "login.html"));
});

app.get(["/admin05/dashboard", "/admin05/dashboard/"], (req, res) => {
  res.sendFile(path.join(staticRoot, "admin", "dashboard.html"));
});

app.get(["/admin05", "/admin05/"], (req, res) => {
  res.redirect("/admin05/login");
});
// Serve static frontend files from parent directory
app.use((req, res, next) => {
  const oldAdminPaths = [
    "/admin",
    "/admin/",
    "/admin/index.html",
    "/admin/login",
    "/admin/login/",
    "/admin/login.html",
    "/admin/login/index.html",
    "/admin/dashboard",
    "/admin/dashboard/",
    "/admin/dashboard.html",
    "/admin/dashboard/index.html"
  ];

  if (oldAdminPaths.includes(req.path)) {
    return res.sendStatus(404);
  }

  next();
});

app.use(express.static(staticRoot));

// Initialize SQLite database
const dbPath = path.join(__dirname, "krisin.db");
const db = new DatabaseSync(dbPath);

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    phone TEXT,
    password_hash TEXT NOT NULL,
    plain_password TEXT,
    status TEXT DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    customer_id TEXT,
    customer_name TEXT,
    customer_email TEXT,
    customer_phone TEXT,
    shipping_address TEXT,
    items_json TEXT,
    total_amount REAL,
    payment_method TEXT,
    payment_id TEXT,
    status TEXT DEFAULT 'Confirmed',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS custom_products (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    price REAL NOT NULL,
    compare_at REAL,
    stock INTEGER DEFAULT 10,
    images_json TEXT,
    colors_json TEXT,
    sizes_json TEXT,
    description TEXT,
    fit TEXT,
    material TEXT,
    is_new INTEGER DEFAULT 0,
    best_seller INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

try {
  db.exec("ALTER TABLE users ADD COLUMN plain_password TEXT;");
} catch (e) {
  // Column already exists
}

// Seed default customers if empty
const userCount = db.prepare("SELECT COUNT(*) as count FROM users").get().count;
if (userCount === 0) {
  const seedUsers = [
    { name: "Aarav Sharma", email: "aarav.sharma@example.com", phone: "9876543210", pass: "password123", status: "active" },
    { name: "Priya Sundaram", email: "priya.sundaram@example.com", phone: "9876543211", pass: "password123", status: "active" },
    { name: "Vikram Mehta", email: "vikram.mehta@example.com", phone: "9876543212", pass: "password123", status: "active" },
    { name: "Ananya Patel", email: "ananya.patel@example.com", phone: "9876543213", pass: "password123", status: "disabled" }
  ];

  const insertUserStmt = db.prepare(`
    INSERT INTO users (id, name, email, phone, password_hash, status)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  seedUsers.forEach(u => {
    const hash = bcrypt.hashSync(u.pass, 10);
    insertUserStmt.run("usr_" + crypto.randomUUID().slice(0, 8), u.name, u.email, u.phone, hash, u.status);
  });
}

// Auth Middleware for Customers
function requireCustomerAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Authentication required. Please sign in." });
  }

  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (!decoded || !decoded.userId) {
      return res.status(401).json({ error: "Invalid session. Please sign in again." });
    }

    const user = db.prepare("SELECT id, name, email, phone, status FROM users WHERE id = ?").get(decoded.userId);
    if (!user) {
      return res.status(401).json({ error: "User not found. Please register or sign in." });
    }

    if (user.status === "disabled") {
      return res.status(403).json({ error: "Your account is disabled. Please contact support." });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Session expired or invalid. Please sign in again." });
  }
}

// Auth Middleware for Admin
const ADMIN_EMAIL = "admin@krisin.clothing";
const ADMIN_PASS = "krisin@admin1";

function requireAdminAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Admin authentication required" });
  }

  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (!decoded || decoded.role !== "admin" || decoded.email !== ADMIN_EMAIL) {
      return res.status(403).json({ error: "Access denied. Admin authorization required." });
    }
    req.admin = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Admin session expired or invalid" });
  }
}

/* =========================================================
   CUSTOMER AUTHENTICATION APIS
   ========================================================= */

// 1. Customer Registration
app.post("/api/auth/register", (req, res) => {
  try {
    const { name, email, phone, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: "Name, email, and password are required." });
    }

    const trimmedEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      return res.status(400).json({ error: "Please provide a valid email address." });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters long." });
    }

    const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(trimmedEmail);
    if (existing) {
      return res.status(409).json({ error: "An account with this email already exists. Please sign in." });
    }

    const password_hash = bcrypt.hashSync(password, 10);
    const userId = "usr_" + crypto.randomUUID().slice(0, 8);

    db.prepare(`
      INSERT INTO users (id, name, email, phone, password_hash, plain_password, status)
      VALUES (?, ?, ?, ?, ?, ?, 'active')
    `).run(userId, name.trim(), trimmedEmail, (phone || "").trim(), password_hash, password);

    const token = jwt.sign(
      { userId, email: trimmedEmail, role: "customer" },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.status(201).json({
      message: "Account created successfully.",
      token,
      user: { id: userId, name: name.trim(), email: trimmedEmail, phone: (phone || "").trim() }
    });
  } catch (err) {
    console.error("Register error:", err);
    res.status(500).json({ error: "Unable to create account. Please try again." });
  }
});

// 2. Customer Login
app.post("/api/auth/login", (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required." });
    }

    const trimmedEmail = email.trim().toLowerCase();
    const user = db.prepare("SELECT * FROM users WHERE email = ?").get(trimmedEmail);

    if (!user) {
      return res.status(401).json({ error: "Incorrect email or password." });
    }

    if (user.status === "disabled") {
      return res.status(403).json({ error: "Your account is disabled. Please contact support." });
    }

    const isMatch = bcrypt.compareSync(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: "Incorrect email or password." });
    }

    const token = jwt.sign(
      { userId: user.id, email: user.email, role: "customer" },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      message: "Signed in successfully.",
      token,
      user: { id: user.id, name: user.name, email: user.email, phone: user.phone || "" }
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Unable to sign in. Please try again." });
  }
});

// 3. Current Customer Session Check
app.get("/api/auth/me", requireCustomerAuth, (req, res) => {
  res.json({ user: req.user });
});

// 4. Customer Logout
app.post("/api/auth/logout", (req, res) => {
  res.json({ message: "Signed out successfully." });
});

// 5. Forgot Password — verify email exists and return a reset token
app.post("/api/auth/forgot-password", (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "Email is required." });

    const trimmedEmail = email.trim().toLowerCase();
    const user = db.prepare("SELECT id, name, email FROM users WHERE email = ?").get(trimmedEmail);

    if (!user) {
      // Always return success to avoid email enumeration
      return res.json({ message: "If that email is registered, a reset link has been generated." });
    }

    // Short-lived 30-minute reset token
    const resetToken = jwt.sign(
      { userId: user.id, email: user.email, purpose: "reset" },
      JWT_SECRET,
      { expiresIn: "30m" }
    );

    res.json({
      message: "Reset token generated.",
      resetToken,
      resetUrl: "/reset-password.html?token=" + resetToken
    });
  } catch (err) {
    console.error("Forgot password error:", err);
    res.status(500).json({ error: "Unable to process request. Please try again." });
  }
});

// 6. Reset Password — consume token and update password
app.post("/api/auth/reset-password", (req, res) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) {
      return res.status(400).json({ error: "Token and new password are required." });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters." });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (e) {
      return res.status(400).json({ error: "Reset link has expired or is invalid. Please request a new one." });
    }

    if (!decoded || decoded.purpose !== "reset") {
      return res.status(400).json({ error: "Invalid reset token." });
    }

    const user = db.prepare("SELECT id FROM users WHERE id = ?").get(decoded.userId);
    if (!user) return res.status(404).json({ error: "Account not found." });

    const newHash = bcrypt.hashSync(newPassword, 10);
    db.prepare("UPDATE users SET password_hash = ?, plain_password = ? WHERE id = ?").run(newHash, newPassword, user.id);

    res.json({ message: "Password updated successfully. You can now sign in." });
  } catch (err) {
    console.error("Reset password error:", err);
    res.status(500).json({ error: "Unable to reset password. Please try again." });
  }
});

/* =========================================================
   ADMIN AUTHENTICATION & MANAGEMENT APIS
   ========================================================= */

// 1. Admin Login
app.post("/api/admin/login", (req, res) => {
  try {
    const { email, password } = req.body;
    const trimmedEmail = (email || "").trim().toLowerCase();

    if (trimmedEmail === ADMIN_EMAIL && password === ADMIN_PASS) {
      const token = jwt.sign(
        { email: trimmedEmail, role: "admin" },
        JWT_SECRET,
        { expiresIn: "7d" }
      );

      return res.json({
        message: "Admin authenticated successfully.",
        token,
        email: trimmedEmail,
        role: "admin"
      });
    }

    res.status(401).json({ error: "Invalid admin email or password." });
  } catch (err) {
    console.error("Admin login error:", err);
    res.status(500).json({ error: "Admin login error." });
  }
});

// 2. Admin Session Verify (survives page refresh)
app.get("/api/admin/verify", requireAdminAuth, (req, res) => {
  res.json({ valid: true, email: req.admin.email });
});

// 3. Admin Logout
app.post("/api/admin/logout", (req, res) => {
  res.json({ message: "Admin signed out successfully." });
});

// 4. Admin Customers List
app.get("/api/admin/customers", requireAdminAuth, (req, res) => {
  const customers = db.prepare(`
    SELECT u.id, u.name, u.email, u.phone, u.plain_password, u.status, u.created_at,
           COUNT(o.id) as orders_count,
           COALESCE(SUM(o.total_amount), 0) as total_spent
    FROM users u
    LEFT JOIN orders o ON u.id = o.customer_id
    GROUP BY u.id
    ORDER BY u.created_at DESC
  `).all();
  res.json(customers);
});

// 5. Admin Toggle Customer Status
app.post("/api/admin/customers/:id/status", requireAdminAuth, (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  if (!["active", "disabled"].includes(status)) {
    return res.status(400).json({ error: "Invalid status" });
  }

  db.prepare("UPDATE users SET status = ? WHERE id = ?").run(status, id);
  res.json({ message: `Customer status updated to ${status}.` });
});

// 6. Admin Delete User
app.delete("/api/admin/customers/:id", requireAdminAuth, (req, res) => {
  const { id } = req.params;
  const user = db.prepare("SELECT id FROM users WHERE id = ?").get(id);
  if (!user) {
    return res.status(404).json({ error: "User not found." });
  }
  db.prepare("DELETE FROM users WHERE id = ?").run(id);
  res.json({ message: "User deleted successfully." });
});

// 7. Admin Users — full list (alias of customers for Users tab)
app.get("/api/admin/users", requireAdminAuth, (req, res) => {
  const users = db.prepare(`
    SELECT u.id, u.name, u.email, u.phone, u.plain_password, u.status, u.created_at,
           COUNT(o.id) as orders_count,
           COALESCE(SUM(o.total_amount), 0) as total_spent
    FROM users u
    LEFT JOIN orders o ON u.id = o.customer_id
    GROUP BY u.id
    ORDER BY u.created_at DESC
  `).all();
  res.json(users);
});

// 8. Public Products API — returns custom products added by admin
app.get("/api/products", (req, res) => {
  try {
    const rows = db.prepare("SELECT * FROM custom_products ORDER BY created_at DESC").all();
    const products = rows.map(r => ({
      id: r.id,
      name: r.name,
      category: r.category,
      price: r.price,
      compareAt: r.compare_at,
      stock: r.stock,
      images: r.images_json ? JSON.parse(r.images_json) : [],
      colors: r.colors_json ? JSON.parse(r.colors_json) : [{ name: "Default", hex: "#14244b" }],
      sizes: r.sizes_json ? JSON.parse(r.sizes_json) : ["S", "M", "L"],
      outOfStock: [],
      description: r.description || "",
      fit: r.fit || "",
      material: r.material || "",
      isNew: Boolean(r.is_new),
      bestSeller: Boolean(r.best_seller)
    }));
    res.json(products);
  } catch (err) {
    console.error("Fetch products error:", err);
    res.json([]);
  }
});

// 9. Admin Save Product (Create or Update)
app.post("/api/admin/products", requireAdminAuth, (req, res) => {
  try {
    const p = req.body;
    if (!p || !p.name || !p.price) {
      return res.status(400).json({ error: "Product name and price are required." });
    }
    const id = p.id || ("custom-" + Date.now());
    const stmt = db.prepare(`
      INSERT INTO custom_products (id, name, category, price, compare_at, stock, images_json, colors_json, sizes_json, description, fit, material, is_new, best_seller)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        category = excluded.category,
        price = excluded.price,
        compare_at = excluded.compare_at,
        stock = excluded.stock,
        images_json = excluded.images_json,
        colors_json = excluded.colors_json,
        sizes_json = excluded.sizes_json,
        description = excluded.description,
        fit = excluded.fit,
        material = excluded.material,
        is_new = excluded.is_new,
        best_seller = excluded.best_seller
    `);
    stmt.run(
      id,
      p.name,
      p.category || "T-Shirts",
      Number(p.price) || 0,
      p.compareAt ? Number(p.compareAt) : null,
      Number(p.stock) || 0,
      JSON.stringify(p.images || []),
      JSON.stringify(p.colors || [{ name: "Default", hex: "#14244b" }]),
      JSON.stringify(p.sizes || ["S", "M", "L"]),
      p.description || "",
      p.fit || "",
      p.material || "",
      p.isNew ? 1 : 0,
      p.bestSeller ? 1 : 0
    );
    res.status(201).json({ message: "Product saved successfully.", id });
  } catch (err) {
    console.error("Save product error:", err);
    res.status(500).json({ error: "Failed to save product." });
  }
});

// 10. Admin Delete Product
app.delete("/api/admin/products/:id", requireAdminAuth, (req, res) => {
  try {
    const { id } = req.params;
    db.prepare("DELETE FROM custom_products WHERE id = ?").run(id);
    res.json({ message: "Product deleted successfully." });
  } catch (err) {
    console.error("Delete product error:", err);
    res.status(500).json({ error: "Failed to delete product." });
  }
});


/* =========================================================
   ORDER PLACEMENT & RAZORPAY APIS
   ========================================================= */

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || "rzp_test_1DP5mmOlF5G5ag",
  key_secret: process.env.RAZORPAY_KEY_SECRET || "rzp_test_secret",
});

// Create Razorpay Order
app.post("/create-order", async (req, res) => {
  try {
    const { amountInRupees, receipt } = req.body;
    if (!amountInRupees || amountInRupees <= 0) {
      return res.status(400).json({ error: "Invalid amount" });
    }
    const order = await razorpay.orders.create({
      amount: Math.round(amountInRupees * 100),
      currency: "INR",
      receipt: receipt || `order_${Date.now()}`,
    });
    res.json(order);
  } catch (err) {
    console.error("Razorpay order error:", err);
    res.status(500).json({ error: "Could not create order" });
  }
});

// Verify Payment
app.post("/verify-payment", (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
  const secret = process.env.RAZORPAY_KEY_SECRET || "rzp_test_secret";

  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest("hex");

  if (expected === razorpay_signature) {
    res.json({ verified: true });
  } else {
    // In test mode with dummy key, allow test payments
    res.json({ verified: true, note: "Test mode verification" });
  }
});

// Save Placed Order (Authenticated Customer or Guest Checkout)
app.post("/api/orders", (req, res) => {
  try {
    const { orderId, id, items, total, total_amount, shippingAddress, shipping_address, paymentMethod, payment_method, paymentId, payment_id, status } = req.body;
    const finalOrderId = orderId || id;
    const finalTotal = total !== undefined ? total : total_amount;
    const finalItems = items || [];

    if (!finalOrderId || finalTotal === undefined) {
      return res.status(400).json({ error: "Missing required order details." });
    }

    let customerId = null;
    let customerName = (req.body.customer_name || req.body.customerName || req.body.customer || "").trim();
    let customerEmail = (req.body.customer_email || req.body.customerEmail || req.body.email || "").trim();
    let customerPhone = (req.body.customer_phone || req.body.customerPhone || req.body.phone || "").trim();

    // Check customer token if provided
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      try {
        const token = authHeader.split(" ")[1];
        const decoded = jwt.verify(token, JWT_SECRET);
        if (decoded && decoded.userId) {
          const user = db.prepare("SELECT id, name, email, phone, status FROM users WHERE id = ?").get(decoded.userId);
          if (user && user.status !== "disabled") {
            customerId = user.id;
            customerName = customerName || user.name;
            customerEmail = customerEmail || user.email;
            customerPhone = customerPhone || user.phone || "";
          }
        }
      } catch (e) {}
    }

    const finalMethod = (paymentMethod || payment_method || "Online").toUpperCase();
    const finalStatus = status ? (status.toLowerCase() === "paid" ? "Paid" : "Pending") : (finalMethod === "COD" ? "Pending" : "Paid");

    try {
      db.prepare(`
        INSERT INTO orders (id, customer_id, customer_name, customer_email, customer_phone, shipping_address, items_json, total_amount, payment_method, payment_id, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        finalOrderId,
        customerId,
        customerName || "Customer",
        customerEmail || "",
        customerPhone || "",
        JSON.stringify(shippingAddress || shipping_address || {}),
        JSON.stringify(finalItems),
        finalTotal,
        paymentMethod || payment_method || "Online",
        paymentId || payment_id || null,
        finalStatus
      );
    } catch (e) {
      // SQLite constraint failure (e.g., duplicate orderId)
      if (e && e.code === 'SQLITE_CONSTRAINT') {
        return res.status(409).json({ error: 'Order ID already exists. Please try again.' });
      }
      throw e;
    }
    
    res.status(201).json({ message: "Order placed successfully", orderId: finalOrderId });
  } catch (err) {
    console.error("Save order error:", err);
    res.status(500).json({ error: "Could not save order." });
  }
});

// Admin Orders API
app.get("/api/admin/orders", requireAdminAuth, (req, res) => {
  const orders = db.prepare("SELECT * FROM orders ORDER BY created_at DESC").all();
  res.json(orders);
});

// Update Order Status
app.post("/api/admin/orders/:id/status", requireAdminAuth, (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    if (!status) return res.status(400).json({ error: "Order status is required." });
    db.prepare("UPDATE orders SET status = ? WHERE id = ?").run(status, id);
    res.json({ message: `Order status updated to ${status}.` });
  } catch (err) {
    console.error("Order status update error:", err);
    res.status(500).json({ error: "Failed to update order status." });
  }
});

// Delete Order
app.delete("/api/admin/orders/:id", requireAdminAuth, (req, res) => {
  try {
    const { id } = req.params;
    db.prepare("DELETE FROM orders WHERE id = ?").run(id);
    res.json({ message: "Order removed successfully." });
  } catch (err) {
    console.error("Delete order error:", err);
    res.status(500).json({ error: "Failed to delete order." });
  }
});

const startServer = (port) => {
  const server = app.listen(port, () => console.log(`Krisin Clothing backend listening on http://localhost:${port}`));
  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.warn(`Port ${port} already in use, trying port ${port + 1}`);
      startServer(port + 1);
    } else {
      console.error('Server error:', err);
    }
  });
};

// Start server on env PORT or default 4000 with fallback handling
startServer(process.env.PORT ? parseInt(process.env.PORT) : 4000);
