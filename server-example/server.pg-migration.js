/**
 * Krisin Clothing â€” Backend Server
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
const pool = require("./db");
const Razorpay = require("razorpay");

const app = express();
app.use(cors());
app.use(express.json());

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error("JWT_SECRET environment variable is required");
}

// Serve static root path
const staticRoot = path.join(__dirname, "..");


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

/* Old admin page URLs should return 404 */
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
// Serve static frontend files from parent directory
app.use(express.static(staticRoot));

// Initialize Neon PostgreSQL connection
pool.query("SELECT 1")
  .then(() => console.log("Connected to Neon PostgreSQL"))
  .catch((err) => console.error("Neon connection error:", err));


/* Verify the Neon PostgreSQL connection.
   Existing tables and records will not be modified. */
pool.query("SELECT 1")
  .then(() => console.log("Neon PostgreSQL is ready"))
  .catch((err) => {
    console.error("Neon PostgreSQL error:", err.message);
  });



/* =========================================================
   SEED CUSTOMERS â€” NEON POSTGRESQL
   ========================================================= */

// Preserve existing Neon customers; seed demo accounts only if empty.
async function seedDefaultCustomers() {
  const result = await pool.query(
    "SELECT COUNT(*)::int AS count FROM customers"
  );

  if (result.rows[0].count > 0) {
    console.log("Existing Neon customers found; skipping seed.");
    return;
  }

  const seedUsers = [
    {
      name: "Aarav Sharma",
      email: "aarav.sharma@example.com",
      phone: "9876543210",
      pass: "password123",
      status: "active"
    },
    {
      name: "Priya Sundaram",
      email: "priya.sundaram@example.com",
      phone: "9876543211",
      pass: "password123",
      status: "active"
    },
    {
      name: "Vikram Mehta",
      email: "vikram.mehta@example.com",
      phone: "9876543212",
      pass: "password123",
      status: "active"
    },
    {
      name: "Ananya Patel",
      email: "ananya.patel@example.com",
      phone: "9876543213",
      pass: "password123",
      status: "disabled"
    }
  ];

  for (const u of seedUsers) {
    const passwordHash = await bcrypt.hash(u.pass, 12);

    await pool.query(
      `INSERT INTO customers
        (name, email, phone, password_hash, status,
         orders_count, ltv, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, 0, 0, NOW(), NOW())
       ON CONFLICT (email) DO NOTHING`,
      [u.name, u.email, u.phone, passwordHash, u.status]
    );
  }

  console.log("Demo customer seed completed.");
}


/* =========================================================
   CUSTOMER AUTHENTICATION MIDDLEWARE
   ========================================================= */

async function requireCustomerAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      error: "Authentication required. Please sign in."
    });
  }

  try {
    const token = authHeader.slice(7);
    const decoded = jwt.verify(token, JWT_SECRET);

    if (!decoded || !decoded.userId) {
      return res.status(401).json({
        error: "Invalid session. Please sign in again."
      });
    }

    const result = await pool.query(
      `SELECT id, name, email, phone, status
       FROM customers
       WHERE id = $1`,
      [decoded.userId]
    );

    const user = result.rows[0];

    if (!user) {
      return res.status(401).json({
        error: "User not found. Please register or sign in."
      });
    }

    if (user.status === "disabled") {
      return res.status(403).json({
        error: "Your account is disabled. Please contact support."
      });
    }

    req.user = user;
    req.customer = user;

    return next();
  } catch (err) {
    if (
      err.name === "JsonWebTokenError" ||
      err.name === "TokenExpiredError"
    ) {
      return res.status(401).json({
        error: "Session expired or invalid. Please sign in again."
      });
    }

    console.error("Customer authentication error:", err);

    return res.status(500).json({
      error: "Unable to verify customer authentication."
    });
  }
}


/* =========================================================
   ADMIN AUTHENTICATION MIDDLEWARE
   ========================================================= */

const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || "").trim().toLowerCase();
const ADMIN_PASS = process.env.ADMIN_PASS;

if (!ADMIN_EMAIL || !ADMIN_PASS) {
  throw new Error("ADMIN_EMAIL and ADMIN_PASS environment variables are required");
}

function requireAdminAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      error: "Admin authentication required."
    });
  }

  try {
    const token = authHeader.slice(7);
    const decoded = jwt.verify(token, JWT_SECRET);

    if (
      !decoded ||
      decoded.role !== "admin" ||
      decoded.email !== ADMIN_EMAIL
    ) {
      return res.status(403).json({
        error: "Access denied. Admin authorization required."
      });
    }

    req.admin = decoded;
    return next();
  } catch (err) {
    return res.status(401).json({
      error: "Admin session expired or invalid."
    });
  }
}


/* =========================================================
   CUSTOMER AUTHENTICATION API â€” REGISTRATION
   ========================================================= */

app.post("/api/auth/register", async (req, res) => {
  try {
    const { name, email, phone, password } = req.body || {};

    if (
      typeof name !== "string" ||
      typeof email !== "string" ||
      typeof password !== "string" ||
      !name.trim() ||
      !email.trim() ||
      !password
    ) {
      return res.status(400).json({
        error: "Name, email, and password are required."
      });
    }

    const trimmedEmail = email.trim().toLowerCase();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      return res.status(400).json({
        error: "Please provide a valid email address."
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        error: "Password must be at least 6 characters long."
      });
    }

    const existing = await pool.query(
      `SELECT id
       FROM customers
       WHERE LOWER(email) = LOWER($1)
       LIMIT 1`,
      [trimmedEmail]
    );

    if (existing.rows.length > 0) {
      return res.status(409).json({
        error: "An account with this email already exists. Please sign in."
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const cleanPhone = typeof phone === "string" ? phone.trim() : "";

    const result = await pool.query(
      `INSERT INTO customers
        (name, email, phone, password_hash, status,
         orders_count, ltv, created_at, updated_at)
       VALUES ($1, $2, $3, $4, 'active', 0, 0, NOW(), NOW())
       RETURNING id, name, email, phone, status`,
      [name.trim(), trimmedEmail, cleanPhone, passwordHash]
    );

    const user = result.rows[0];
    const userId = String(user.id);

    const token = jwt.sign(
      {
        userId,
        email: user.email,
        role: "customer"
      },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    return res.status(201).json({
      message: "Account created successfully.",
      token,
      user: {
        id: userId,
        name: user.name,
        email: user.email,
        phone: user.phone || "",
        status: user.status
      }
    });
  } catch (err) {
    // Handles simultaneous registrations for the same email.
    if (err.code === "23505") {
      return res.status(409).json({
        error: "An account with this email already exists. Please sign in."
      });
    }

    console.error("Register error:", err);

    return res.status(500).json({
      error: "Unable to create account. Please try again."
    });
  }
});

// 2. Customer Login
// 2. Customer Login
app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({
        error: "Email and password are required."
      });
    }

    const trimmedEmail = email.trim().toLowerCase();

    const result = await pool.query(
      `SELECT id, name, email, phone, password_hash, status
       FROM customers
       WHERE LOWER(email) = LOWER($1)`,
      [trimmedEmail]
    );

    const user = result.rows[0];

    if (!user || !user.password_hash) {
      return res.status(401).json({
        error: "Incorrect email or password. Older accounts may need a password reset."
      });
    }

    if (user.status === "disabled") {
      return res.status(403).json({
        error: "Your account is disabled. Please contact support."
      });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);

    if (!isMatch) {
      return res.status(401).json({
        error: "Incorrect email or password."
      });
    }

    const token = jwt.sign(
      { userId: String(user.id), email: user.email, role: "customer" },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      message: "Signed in successfully.",
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone || ""
      }
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({
      error: "Unable to sign in. Please try again."
    });
  }
});

// 3. Current Customer Session Check
app.get("/api/auth/me", requireCustomerAuth, (req, res) => {
  res.json({ user: req.customer || req.user });
});

// 4. Customer Logout
app.post("/api/auth/logout", (_req, res) => {
  res.json({ message: "Signed out successfully." });
});

// 5. Forgot Password
app.post("/api/auth/forgot-password", async (req, res) => {
  try {
    const email = String((req.body || {}).email || "")
      .trim()
      .toLowerCase();

    if (!email) {
      return res.status(400).json({ error: "Email is required." });
    }

    const result = await pool.query(
      "SELECT id, email FROM customers WHERE LOWER(email) = LOWER($1)",
      [email]
    );

    const user = result.rows[0];

    // Same response whether or not the account exists.
    if (!user) {
      return res.json({
        message: "If that email is registered, password reset instructions will be provided."
      });
    }

    const resetToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256")
      .update(resetToken)
      .digest("hex");

    await pool.query(`
      ALTER TABLE customers
      ADD COLUMN IF NOT EXISTS reset_token_hash TEXT
    `);

    await pool.query(`
      ALTER TABLE customers
      ADD COLUMN IF NOT EXISTS reset_token_expires TIMESTAMPTZ
    `);

    await pool.query(
      `UPDATE customers
       SET reset_token_hash = $1,
           reset_token_expires = NOW() + INTERVAL '30 minutes'
       WHERE id = $2`,
      [tokenHash, user.id]
    );

    // Development only: don't expose reset tokens in production.
    const response = {
      message: "If that email is registered, password reset instructions will be provided."
    };

    if (process.env.NODE_ENV !== "production") {
      response.resetToken = resetToken;
      response.resetUrl = "/reset-password.html?token=" + resetToken;
    }

    res.json(response);
  } catch (err) {
    console.error("Forgot password error:", err);
    res.status(500).json({
      error: "Unable to process request. Please try again."
    });
  }
});

// 6. Reset Password
app.post("/api/auth/reset-password", async (req, res) => {
  try {
    const { token, newPassword, password } = req.body || {};
    const newPass = newPassword || password;

    if (!token || !newPass) {
      return res.status(400).json({
        error: "Token and new password are required."
      });
    }

    if (String(newPass).length < 6) {
      return res.status(400).json({
        error: "Password must be at least 6 characters."
      });
    }

    const tokenHash = crypto.createHash("sha256")
      .update(String(token))
      .digest("hex");

    const passwordHash = await bcrypt.hash(String(newPass), 12);

    const result = await pool.query(
      `UPDATE customers
       SET password_hash = $1,
           reset_token_hash = NULL,
           reset_token_expires = NULL,
           updated_at = NOW()
       WHERE reset_token_hash = $2
         AND reset_token_expires > NOW()
       RETURNING id`,
      [passwordHash, tokenHash]
    );

    if (result.rowCount === 0) {
      return res.status(400).json({
        error: "Reset link has expired or is invalid. Please request a new one."
      });
    }

    res.json({
      message: "Password updated successfully. You can now sign in."
    });
  } catch (err) {
    console.error("Reset password error:", err);
    res.status(500).json({
      error: "Unable to reset password. Please try again."
    });
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
app.get("/api/admin/customers", requireAdminAuth, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        c.id,
        c.name,
        c.email,
        c.phone,
        c.status,
        c.created_at,
        COUNT(o.id)::int AS orders_count,
        COALESCE(SUM(o.total), 0) AS total_spent
      FROM customers c
      LEFT JOIN orders o
        ON LOWER(c.email) = LOWER(o.customer_email)
      GROUP BY c.id
      ORDER BY c.created_at DESC
    `);

    res.json(result.rows);
  } catch (err) {
    console.error("Fetch customers error:", err);
    res.status(500).json({ error: "Unable to load customers." });
  }
});

/* =========================================================
   5. ADMIN CUSTOMER MANAGEMENT â€” NEON POSTGRESQL
   ========================================================= */

// 5. Admin Toggle Customer Status
app.post("/api/admin/customers/:id/status", requireAdminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!["active", "disabled"].includes(status)) {
      return res.status(400).json({ error: "Invalid status." });
    }

    const result = await pool.query(
      `UPDATE customers
       SET status = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING id`,
      [status, id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Customer not found." });
    }

    res.json({ message: `Customer status updated to ${status}.` });
  } catch (err) {
    console.error("Customer status update error:", err);
    res.status(500).json({ error: "Failed to update customer status." });
  }
});

// 6. Admin Delete Customer
app.delete("/api/admin/customers/:id", requireAdminAuth, async (req, res) => {
  try {
    const result = await pool.query(
      "DELETE FROM customers WHERE id = $1 RETURNING id",
      [req.params.id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Customer not found." });
    }

    res.json({ message: "Customer deleted successfully." });
  } catch (err) {
    console.error("Delete customer error:", err);
    res.status(500).json({
      error: "Failed to delete customer. Check whether related records prevent deletion."
    });
  }
});

// 7. Admin Users â€” alias of customers for the Users tab
app.get("/api/admin/users", requireAdminAuth, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        c.id,
        c.name,
        c.email,
        c.phone,
        c.status,
        c.created_at,
        COUNT(o.id)::int AS orders_count,
        COALESCE(SUM(o.total), 0) AS total_spent
      FROM customers c
      LEFT JOIN orders o
        ON LOWER(c.email) = LOWER(o.customer_email)
      GROUP BY c.id
      ORDER BY c.created_at DESC
    `);

    // Never return password hashes or plaintext passwords to the admin UI.
    res.json(result.rows);
  } catch (err) {
    console.error("Fetch admin users error:", err);
    res.status(500).json({ error: "Failed to fetch customers." });
  }
});


/* =========================================================
   8â€“10. PRODUCTS â€” NEON POSTGRESQL
   Uses the existing products table and JSONB columns.
   ========================================================= */

// 8. Public Products API
app.get("/api/products", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        id, name, category, price, colors, sizes,
        out_of_stock, stock, images, description,
        fit, material, is_new, best_seller,
        created_at, updated_at
      FROM products
      ORDER BY created_at DESC
    `);

    const products = result.rows.map((p) => ({
      id: p.id,
      name: p.name,
      category: p.category,
      price: Number(p.price),
      stock: Number(p.stock || 0),
      images: p.images || [],
      colors: p.colors || [{ name: "Default", hex: "#14244b" }],
      sizes: p.sizes || ["S", "M", "L"],
      outOfStock: p.out_of_stock || [],
      description: p.description || "",
      fit: p.fit || "",
      material: p.material || "",
      isNew: Boolean(p.is_new),
      bestSeller: Boolean(p.best_seller),
      createdAt: p.created_at,
      updatedAt: p.updated_at
    }));

    res.json(products);
  } catch (err) {
    console.error("Fetch products error:", err);
    res.status(500).json({ error: "Failed to fetch products." });
  }
});

// 9. Admin Save Product â€” Create or Update
app.post("/api/admin/products", requireAdminAuth, async (req, res) => {
  try {
    const p = req.body;

    if (!p || !String(p.name || "").trim() ||
        p.price === undefined || p.price === null ||
        p.price === "" || !Number.isFinite(Number(p.price)) ||
        Number(p.price) < 0) {
      return res.status(400).json({
        error: "A valid product name and price are required."
      });
    }

    const id = p.id || `custom-${Date.now()}`;
    const name = String(p.name).trim();
    const category = p.category || "T-Shirts";
    const price = Number(p.price);
    const stock = Math.max(0, Number(p.stock) || 0);
    const colors = p.colors || [{ name: "Default", hex: "#14244b" }];
    const sizes = p.sizes || ["S", "M", "L"];
    const outOfStock = p.outOfStock || p.out_of_stock || [];
    const images = p.images || [];

    const result = await pool.query(`
      INSERT INTO products (
        id, name, category, price, colors, sizes,
        out_of_stock, stock, images, description,
        fit, material, is_new, best_seller,
        created_at, updated_at
      )
      VALUES (
        $1, $2, $3, $4, $5::jsonb, $6::jsonb,
        $7::jsonb, $8, $9::jsonb, $10,
        $11, $12, $13, $14, NOW(), NOW()
      )
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        category = EXCLUDED.category,
        price = EXCLUDED.price,
        colors = EXCLUDED.colors,
        sizes = EXCLUDED.sizes,
        out_of_stock = EXCLUDED.out_of_stock,
        stock = EXCLUDED.stock,
        images = EXCLUDED.images,
        description = EXCLUDED.description,
        fit = EXCLUDED.fit,
        material = EXCLUDED.material,
        is_new = EXCLUDED.is_new,
        best_seller = EXCLUDED.best_seller,
        updated_at = NOW()
      RETURNING id
    `, [
      id,
      name,
      category,
      price,
      JSON.stringify(colors),
      JSON.stringify(sizes),
      JSON.stringify(outOfStock),
      stock,
      JSON.stringify(images),
      p.description || "",
      p.fit || "",
      p.material || "",
      Boolean(p.isNew ?? p.is_new),
      Boolean(p.bestSeller ?? p.best_seller)
    ]);

    res.status(200).json({
      message: "Product saved successfully.",
      id: result.rows[0].id
    });
  } catch (err) {
    console.error("Save product error:", err);
    res.status(500).json({ error: "Failed to save product." });
  }
});

// 10. Admin Delete Product
app.delete("/api/admin/products/:id", requireAdminAuth, async (req, res) => {
  try {
    const result = await pool.query(
      "DELETE FROM products WHERE id = $1 RETURNING id",
      [req.params.id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Product not found." });
    }

    res.json({ message: "Product deleted successfully." });
  } catch (err) {
    console.error("Delete product error:", err);
    res.status(500).json({ error: "Failed to delete product." });
  }
});


/* =========================================================
   ORDER PLACEMENT & RAZORPAY APIS
   ========================================================= */

// Configure Razorpay only when real environment credentials are provided.
// Do not rely on hard-coded secret keys.
const razorpay =
  process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET
    ? new Razorpay({
        key_id: process.env.RAZORPAY_KEY_ID,
        key_secret: process.env.RAZORPAY_KEY_SECRET
      })
    : null;

// Create Razorpay Order
app.post("/create-order", async (req, res) => {
  try {
    if (!razorpay) {
      return res.status(503).json({
        error: "Razorpay is not configured on the server."
      });
    }

    const amountInRupees = Number(req.body.amountInRupees);
    const { receipt } = req.body;

    if (!Number.isFinite(amountInRupees) || amountInRupees <= 0) {
      return res.status(400).json({ error: "Invalid amount." });
    }

    const order = await razorpay.orders.create({
      amount: Math.round(amountInRupees * 100),
      currency: "INR",
      receipt: receipt || `order_${Date.now()}`
    });

    res.json(order);
  } catch (err) {
    console.error("Razorpay order error:", err);
    res.status(500).json({ error: "Could not create payment order." });
  }
});

// Verify Razorpay Payment
app.post("/verify-payment", (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } =
      req.body;

    const secret = process.env.RAZORPAY_KEY_SECRET;

    if (
      !secret ||
      !razorpay_order_id ||
      !razorpay_payment_id ||
      !razorpay_signature
    ) {
      return res.status(400).json({
        verified: false,
        error: "Missing payment verification details."
      });
    }

    const expected = crypto
      .createHmac("sha256", secret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    const expectedBuffer = Buffer.from(expected, "hex");
    const receivedBuffer = Buffer.from(razorpay_signature, "hex");

    if (
      expectedBuffer.length !== receivedBuffer.length ||
      !crypto.timingSafeEqual(expectedBuffer, receivedBuffer)
    ) {
      return res.status(400).json({
        verified: false,
        error: "Payment signature verification failed."
      });
    }

    res.json({ verified: true });
  } catch (err) {
    console.error("Payment verification error:", err);
    res.status(500).json({
      verified: false,
      error: "Could not verify payment."
    });
  }
});


/* =========================================================
   SAVE PLACED ORDER â€” NEON POSTGRESQL
   ========================================================= */

app.post("/api/orders", async (req, res) => {
  try {
    const body = req.body || {};

    const finalOrderId = body.orderId || body.id;
    const finalItems = body.items || [];

    const rawTotal =
      body.total !== undefined ? body.total : body.total_amount;
    const finalTotal = Number(rawTotal);

    if (!finalOrderId || rawTotal === undefined ||
        !Number.isFinite(finalTotal) || finalTotal < 0) {
      return res.status(400).json({
        error: "Missing or invalid order details."
      });
    }

    let customerName = String(
      body.customer_name || body.customerName || body.customer || ""
    ).trim();

    let customerEmail = String(
      body.customer_email || body.customerEmail || body.email || ""
    ).trim();

    let customerPhone = String(
      body.customer_phone || body.customerPhone || body.phone || ""
    ).trim();

    // If a valid customer token is supplied, use the matching Neon customer.
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith("Bearer ")) {
      try {
        const token = authHeader.slice(7);
        const decoded = jwt.verify(token, JWT_SECRET);

        if (decoded && decoded.userId) {
          const userResult = await pool.query(
            `SELECT id, name, email, phone, status
             FROM customers
             WHERE id = $1`,
            [decoded.userId]
          );

          const user = userResult.rows[0];

          if (user && user.status !== "disabled") {
            customerName = customerName || user.name;
            customerEmail = customerEmail || user.email;
            customerPhone = customerPhone || user.phone || "";
          }
        }
      } catch (authError) {
        // Allow guest checkout; validate the required order fields below.
      }
    }

    if (!customerEmail) {
      return res.status(400).json({
        error: "Customer email is required to save the order."
      });
    }

    customerName = customerName || "Customer";

    const shippingAddress =
      body.shippingAddress || body.shipping_address || {};

    const paymentMethod = String(
      body.paymentMethod || body.payment_method || "Online"
    );

    const normalizedMethod = paymentMethod.toUpperCase();

    const paymentId =
      body.razorpay_payment_id ||
      body.paymentId ||
      body.payment_id ||
      null;

    const razorpayOrderId =
      body.razorpay_order_id || null;

    const razorpaySignature =
      body.razorpay_signature || null;

    const requestedStatus = String(body.status || "").toLowerCase();

    const paymentStatus =
      requestedStatus === "paid" || paymentId
        ? "paid"
        : normalizedMethod === "COD"
          ? "pending"
          : "pending";

    const subtotal = Number(body.subtotal ?? finalTotal);
    const shippingFee = Number(body.shipping_fee ?? body.shippingFee ?? 0);
    const codFee = Number(body.cod_fee ?? body.codFee ?? 0);
    const discount = Number(body.discount ?? 0);

    if (
      ![subtotal, shippingFee, codFee, discount].every(Number.isFinite) ||
      shippingFee < 0 || codFee < 0 || discount < 0
    ) {
      return res.status(400).json({
        error: "Invalid order amount details."
      });
    }

    const result = await pool.query(`
      INSERT INTO orders (
        id,
        customer_name,
        customer_email,
        customer_phone,
        shipping_address,
        items,
        subtotal,
        shipping_fee,
        cod_fee,
        discount,
        total,
        payment_method,
        payment_status,
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
        status,
        created_at
      )
      VALUES (
        $1, $2, $3, $4, $5::jsonb, $6::jsonb,
        $7, $8, $9, $10, $11, $12, $13,
        $14, $15, $16, $17, NOW()
      )
      RETURNING id
    `, [
      String(finalOrderId),
      customerName,
      customerEmail,
      customerPhone,
      JSON.stringify(shippingAddress),
      JSON.stringify(finalItems),
      subtotal,
      shippingFee,
      codFee,
      discount,
      finalTotal,
      paymentMethod,
      paymentStatus,
      razorpayOrderId,
      paymentId,
      razorpaySignature,
      requestedStatus || "pending"
    ]);

    res.status(201).json({
      message: "Order placed successfully.",
      orderId: result.rows[0].id
    });
  } catch (err) {
    if (err.code === "23505") {
      return res.status(409).json({
        error: "Order ID already exists. Please try again."
      });
    }

    console.error("Save order error:", err);
    res.status(500).json({ error: "Could not save order." });
  }
});


/* =========================================================
   ADMIN ORDERS â€” NEON POSTGRESQL
   ========================================================= */

function formatCustomerOrder(row) {
  return {
    id: row.id,
    createdAt: row.created_at,
    totalAmount: Number(row.total),
    total: Number(row.total),
    status: row.status,
    paymentMethod: row.payment_method,
    paymentStatus: row.payment_status,
    paymentId: row.razorpay_payment_id || null,
    customerName: row.customer_name,
    customerEmail: row.customer_email,
    customerPhone: row.customer_phone,
    shippingAddress: row.shipping_address || {},
    items: row.items || [],
    subtotal: Number(row.subtotal),
    shippingFee: Number(row.shipping_fee),
    codFee: Number(row.cod_fee),
    estimatedDelivery: null,
    cancelledAt: null,
    cancellationReason: null,
    timeline: []
  };
}

async function findCustomerOrder(orderId, customerEmail) {
  const result = await pool.query(
    `SELECT * FROM orders
     WHERE id = $1 AND LOWER(customer_email) = LOWER($2)
     LIMIT 1`,
    [orderId, customerEmail]
  );
  return result.rows[0] || null;
}

// Get orders belonging to the signed-in customer
app.get("/api/orders/my-orders", requireCustomerAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM orders
       WHERE LOWER(customer_email) = LOWER($1)
       ORDER BY created_at DESC`,
      [req.user.email]
    );
    res.json(result.rows.map(formatCustomerOrder));
  } catch (err) {
    console.error("Fetch customer orders error:", err);
    res.status(500).json({ error: "Could not fetch your orders." });
  }
});

// Get one order belonging to the signed-in customer
app.get("/api/orders/:id", requireCustomerAuth, async (req, res) => {
  try {
    const order = await findCustomerOrder(req.params.id, req.user.email);

    if (!order) {
      return res.status(404).json({ error: "Order not found." });
    }

    res.json(formatCustomerOrder(order));
  } catch (err) {
    console.error("Fetch customer order error:", err);
    res.status(500).json({ error: "Could not fetch this order." });
  }
});

// Cancel an eligible order belonging to the signed-in customer
app.patch("/api/orders/:id/cancel", requireCustomerAuth, async (req, res) => {
  let client;

  try {
    client = await pool.connect();
    await client.query("BEGIN");

    const result = await client.query(
      `SELECT * FROM orders
       WHERE id = $1 AND LOWER(customer_email) = LOWER($2)
       LIMIT 1 FOR UPDATE`,
      [req.params.id, req.user.email]
    );

    const order = result.rows[0];

    if (!order) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Order not found." });
    }

    const eligibleStatuses = [
      "order placed",
      "order confirmed",
      "processing",
      "pending",
      "confirmed"
    ];

    if (!eligibleStatuses.includes(String(order.status || "").toLowerCase())) {
      await client.query("ROLLBACK");
      return res.status(409).json({
        error: "This order can no longer be cancelled online."
      });
    }

       const updated = await client.query(
      `UPDATE orders
       SET status = 'cancelled'
       WHERE id = $1
         AND LOWER(customer_email) = LOWER($2)
       RETURNING *`,
      [req.params.id, req.user.email]
    );

    if (!updated.rows[0]) {
      await client.query("ROLLBACK");
      return res.status(409).json({
        error: "The order changed and could not be cancelled. Please refresh and try again."
      });
    }

    await client.query("COMMIT");

    res.json({
      message: "Order cancelled. This does not automatically process a payment refund.",
      order: formatCustomerOrder(updated.rows[0])
    });
  } catch (err) {
    if (client) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackErr) {
        console.error("Order cancellation rollback error:", rollbackErr);
      }
    }

    console.error("Cancel customer order error:", err);
    res.status(500).json({ error: "Could not cancel this order." });
  } finally {
    if (client) client.release();
  }
});

// List all orders
app.get("/api/admin/orders", requireAdminAuth, async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM orders ORDER BY created_at DESC"
    );

    res.json(result.rows);
  } catch (err) {
    console.error("Fetch admin orders error:", err);
    res.status(500).json({ error: "Failed to fetch orders." });
  }
});

// Update order status
app.post("/api/admin/orders/:id/status", requireAdminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status || typeof status !== "string") {
      return res.status(400).json({
        error: "Order status is required."
      });
    }

    const result = await pool.query(
      `UPDATE orders
       SET status = $1
       WHERE id = $2
       RETURNING id`,
      [status, id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Order not found." });
    }

    res.json({ message: `Order status updated to ${status}.` });
  } catch (err) {
    console.error("Order status update error:", err);
    res.status(500).json({ error: "Failed to update order status." });
  }
});

// Delete order
app.delete("/api/admin/orders/:id", requireAdminAuth, async (req, res) => {
  try {
    const result = await pool.query(
      "DELETE FROM orders WHERE id = $1 RETURNING id",
      [req.params.id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Order not found." });
    }

    res.json({ message: "Order removed successfully." });
  } catch (err) {
    console.error("Delete order error:", err);
    res.status(500).json({ error: "Failed to delete order." });
  }
});


/* =========================================================
   START SERVER
   ========================================================= */

const port = Number(process.env.PORT || 4000);

const server = app.listen(port, () => {
  console.log(`Krisin Clothing PostgreSQL migration server listening on port ${port}`);
});

server.on("error", (err) => {
  console.error("Server startup error:", err);
});
