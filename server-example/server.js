/**
 * Krisin Clothing — Backend API Server with Neon PostgreSQL
 * 
 * Features:
 * - Neon PostgreSQL database connection
 * - Full CRUD for Products, Categories, Inventory
 * - Customer access control & status enforcement
 * - Order placement (COD & Razorpay) and management
 * - Coupons and Customer Reviews moderation
 * - Real-time store analytics & dashboard metrics
 * - Razorpay order creation and HMAC signature verification
 */

require("dotenv").config();
const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const Razorpay = require("razorpay");
const path = require("path");
const { query, isDatabaseConfigured, testConnection } = require("./db");


const app = express();

// Render runs the app behind a proxy.
app.set("trust proxy", 3);

app.use(cors());
app.use(express.json());

// Restrict admin pages and sensitive admin API endpoints by IP.
const adminAllowedIps = (process.env.ADMIN_ALLOWED_IPS || "")
  .split(",")
  .map(ip => ip.trim())
  .filter(Boolean);

function adminIpAllowlist(req, res, next) {
  const requestPath = req.path;
  const method = req.method;

  const isAdminPage =
    requestPath === "/admin" ||
    requestPath.startsWith("/admin/");

  const isAdminApi =
    requestPath === "/api/auth/login" ||
    requestPath === "/api/inventory" ||
    requestPath === "/api/customers" ||
    requestPath.startsWith("/api/customers/") &&
      method === "PATCH" ||
    requestPath === "/api/orders" &&
      method === "GET" ||
    /^\/api\/orders\/[^/]+\/status$/.test(requestPath) &&
      method === "PATCH" ||
    requestPath === "/api/coupons" &&
      ["GET", "POST"].includes(method) ||
    /^\/api\/products\/[^/]+$/.test(requestPath) &&
      ["PUT", "DELETE"].includes(method) ||
    requestPath === "/api/products" &&
      method === "POST" ||
    /^\/api\/reviews\/[^/]+\/status$/.test(requestPath) &&
      method === "PATCH" ||
    requestPath === "/api/admin/stats";

  if (!isAdminPage && !isAdminApi) {
    return next();
  }

  if (adminAllowedIps.length === 0) {
    return res.status(503).send("Admin IP allowlist is not configured.");
  }
console.log("X-Forwarded-For:", req.headers["x-forwarded-for"]);
console.log("X-Real-IP:", req.headers["x-real-ip"]);
console.log("Express IP:", req.ip);
console.log("Socket IP:", req.socket.remoteAddress);
const clientIp = (req.ip || "").replace(/^::ffff:/, "");
console.log("Detected IP:", clientIp);
console.log("Allowed IPs:", adminAllowedIps);
if (!adminAllowedIps.includes(clientIp)) {
  return res.status(403).send("Access denied: IP address not allowed.");
}

return next();
  console.log("Detected client IP:", clientIp);
  console.log("Allowed IPs:", adminAllowedIps);

  if (!adminAllowedIps.includes(clientIp)) {
    return res.status(403).send("Access denied: IP address not allowed.");
  }

  next();
}

app.use(adminIpAllowlist);


// Optionally serve static storefront from the parent directory
app.use(express.static(path.join(__dirname, "..")));

// Initialize Razorpay (supports test keys or environment variables)
const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || "rzp_test_1DP5mmOlF5G5ag";
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || "";

let razorpay = null;
if (RAZORPAY_KEY_SECRET) {
  razorpay = new Razorpay({
    key_id: RAZORPAY_KEY_ID,
    key_secret: RAZORPAY_KEY_SECRET,
  });
}

// Helper: Ensure DB is connected
function requireDb(req, res, next) {
  if (!isDatabaseConfigured()) {
    return res.status(503).json({
      error: "Neon database is not configured. Please set DATABASE_URL in server-example/.env",
      dbConfigured: false,
    });
  }
  next();
}

// =========================================================
// 1. SYSTEM & HEALTH CHECK
// =========================================================
app.get("/api/health", async (req, res) => {
  const dbStatus = await testConnection();
  res.json({
    status: "ok",
    database: {
      type: "Neon PostgreSQL",
      configured: isDatabaseConfigured(),
      connected: dbStatus.ok,
      details: dbStatus.ok ? { db: dbStatus.database, time: dbStatus.time } : { error: dbStatus.error }
    },
    razorpay: {
      configured: Boolean(RAZORPAY_KEY_SECRET),
      keyId: RAZORPAY_KEY_ID
    },
    uptime: process.uptime()
  });
});

// =========================================================
// 2. ADMIN AUTHENTICATION
// =========================================================
app.post("/api/auth/login", requireDb, async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const result = await query("SELECT * FROM admins WHERE LOWER(email) = LOWER($1)", [email.trim()]);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const admin = result.rows[0];
    const match = await bcrypt.compare(password, admin.password_hash);
    if (!match) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    // Return session/token payload
    res.json({
      success: true,
      admin: {
        id: admin.id,
        email: admin.email,
        name: admin.name,
        role: admin.role,
      },
      token: Buffer.from(`${admin.id}:${Date.now()}`).toString("base64"), // Simple bearer token
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Login failed" });
  }
});

// =========================================================
// 3. PRODUCTS API
// =========================================================
// GET /api/products — list products with optional category, search, and sort
app.get("/api/products", requireDb, async (req, res) => {
  try {
    const { category, search, sort } = req.query;
    let sql = "SELECT * FROM products WHERE 1=1";
    const params = [];

    if (category && category !== "All") {
      params.push(category);
      sql += ` AND category = $${params.length}`;
    }

    if (search && search.trim()) {
      params.push(`%${search.trim().toLowerCase()}%`);
      sql += ` AND (LOWER(name) LIKE $${params.length} OR LOWER(description) LIKE $${params.length})`;
    }

    // Sorting
    if (sort === "price-asc") {
      sql += " ORDER BY price ASC";
    } else if (sort === "price-desc") {
      sql += " ORDER BY price DESC";
    } else if (sort === "newest") {
      sql += " ORDER BY is_new DESC, created_at DESC";
    } else if (sort === "bestseller") {
      sql += " ORDER BY best_seller DESC, id ASC";
    } else {
      sql += " ORDER BY id ASC";
    }

    const result = await query(sql, params);
    
    // Map database fields to front-end format
    const products = result.rows.map(row => ({
      id: row.id,
      name: row.name,
      category: row.category,
      price: Number(row.price),
      compareAt: row.compare_at ? Number(row.compare_at) : null,
      colors: typeof row.colors === "string" ? JSON.parse(row.colors) : row.colors,
      sizes: typeof row.sizes === "string" ? JSON.parse(row.sizes) : row.sizes,
      outOfStock: typeof row.out_of_stock === "string" ? JSON.parse(row.out_of_stock) : row.out_of_stock,
      stock: Number(row.stock),
      images: typeof row.images === "string" ? JSON.parse(row.images) : row.images,
      description: row.description,
      fit: row.fit,
      material: row.material,
      isNew: Boolean(row.is_new),
      bestSeller: Boolean(row.best_seller),
    }));

    res.json(products);
  } catch (err) {
    console.error("Fetch products error:", err);
    res.status(500).json({ error: "Failed to fetch products" });
  }
});

// GET /api/products/:id — single product
app.get("/api/products/:id", requireDb, async (req, res) => {
  try {
    const result = await query("SELECT * FROM products WHERE id = $1", [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Product not found" });
    }
    const row = result.rows[0];
    res.json({
      id: row.id,
      name: row.name,
      category: row.category,
      price: Number(row.price),
      compareAt: row.compare_at ? Number(row.compare_at) : null,
      colors: typeof row.colors === "string" ? JSON.parse(row.colors) : row.colors,
      sizes: typeof row.sizes === "string" ? JSON.parse(row.sizes) : row.sizes,
      outOfStock: typeof row.out_of_stock === "string" ? JSON.parse(row.out_of_stock) : row.out_of_stock,
      stock: Number(row.stock),
      images: typeof row.images === "string" ? JSON.parse(row.images) : row.images,
      description: row.description,
      fit: row.fit,
      material: row.material,
      isNew: Boolean(row.is_new),
      bestSeller: Boolean(row.best_seller),
    });
  } catch (err) {
    console.error("Get product error:", err);
    res.status(500).json({ error: "Failed to get product" });
  }
});

// POST /api/products — add new product
app.post("/api/products", requireDb, async (req, res) => {
  try {
    const p = req.body;
    const id = p.id || `mc-${Date.now().toString().slice(-4)}`;
    
    await query(
      `INSERT INTO products (
        id, name, category, price, compare_at, colors, sizes, out_of_stock,
        stock, images, description, fit, material, is_new, best_seller
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
      [
        id,
        p.name,
        p.category || "General",
        Number(p.price) || 0,
        p.compareAt ? Number(p.compareAt) : null,
        JSON.stringify(p.colors || []),
        JSON.stringify(p.sizes || ["S", "M", "L"]),
        JSON.stringify(p.outOfStock || []),
        Number(p.stock) || 0,
        JSON.stringify(p.images || []),
        p.description || "",
        p.fit || "",
        p.material || "",
        Boolean(p.isNew),
        Boolean(p.bestSeller),
      ]
    );

    res.status(201).json({ success: true, id, message: "Product created" });
  } catch (err) {
    console.error("Create product error:", err);
    res.status(500).json({ error: "Failed to create product" });
  }
});

// PUT /api/products/:id — update existing product
app.put("/api/products/:id", requireDb, async (req, res) => {
  try {
    const id = req.params.id;
    const p = req.body;

    const result = await query(
      `UPDATE products SET
        name = COALESCE($1, name),
        category = COALESCE($2, category),
        price = COALESCE($3, price),
        compare_at = $4,
        colors = COALESCE($5, colors),
        sizes = COALESCE($6, sizes),
        out_of_stock = COALESCE($7, out_of_stock),
        stock = COALESCE($8, stock),
        images = COALESCE($9, images),
        description = COALESCE($10, description),
        is_new = COALESCE($11, is_new),
        best_seller = COALESCE($12, best_seller),
        updated_at = CURRENT_TIMESTAMP
       WHERE id = $13 RETURNING *`,
      [
        p.name,
        p.category,
        p.price !== undefined ? Number(p.price) : null,
        p.compareAt !== undefined ? (p.compareAt ? Number(p.compareAt) : null) : null,
        p.colors ? JSON.stringify(p.colors) : null,
        p.sizes ? JSON.stringify(p.sizes) : null,
        p.outOfStock ? JSON.stringify(p.outOfStock) : null,
        p.stock !== undefined ? Number(p.stock) : null,
        p.images ? JSON.stringify(p.images) : null,
        p.description,
        p.isNew !== undefined ? Boolean(p.isNew) : null,
        p.bestSeller !== undefined ? Boolean(p.bestSeller) : null,
        id,
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Product not found" });
    }

    res.json({ success: true, message: "Product updated", product: result.rows[0] });
  } catch (err) {
    console.error("Update product error:", err);
    res.status(500).json({ error: "Failed to update product" });
  }
});

// DELETE /api/products/:id — delete product
app.delete("/api/products/:id", requireDb, async (req, res) => {
  try {
    const result = await query("DELETE FROM products WHERE id = $1 RETURNING id", [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Product not found" });
    }
    res.json({ success: true, message: "Product deleted" });
  } catch (err) {
    console.error("Delete product error:", err);
    res.status(500).json({ error: "Failed to delete product" });
  }
});

// =========================================================
// 4. CATEGORIES API
// =========================================================
app.get("/api/categories", requireDb, async (req, res) => {
  try {
    const result = await query(`
      SELECT c.name, COUNT(p.id) as product_count
      FROM categories c
      LEFT JOIN products p ON p.category = c.name
      GROUP BY c.id, c.name
      ORDER BY c.name ASC
    `);
    res.json(result.rows.map(r => ({ name: r.name, count: Number(r.product_count) })));
  } catch (err) {
    console.error("Categories error:", err);
    res.status(500).json({ error: "Failed to fetch categories" });
  }
});

// =========================================================
// 5. INVENTORY API
// =========================================================
app.get("/api/inventory", requireDb, async (req, res) => {
  try {
    const result = await query("SELECT id, name, sizes, out_of_stock, stock FROM products ORDER BY stock ASC");
    res.json(result.rows.map(r => ({
      id: r.id,
      name: r.name,
      sizes: typeof r.sizes === "string" ? JSON.parse(r.sizes) : r.sizes,
      outOfStock: typeof r.out_of_stock === "string" ? JSON.parse(r.out_of_stock) : r.out_of_stock,
      stock: Number(r.stock)
    })));
  } catch (err) {
    console.error("Inventory error:", err);
    res.status(500).json({ error: "Failed to fetch inventory" });
  }
});

// =========================================================
// 6. CUSTOMERS API & ACCESS CONTROL
// =========================================================
app.get("/api/customers", requireDb, async (req, res) => {
  try {
    const result = await query("SELECT * FROM customers ORDER BY ltv DESC");
    res.json(result.rows.map(r => ({
      id: r.id,
      name: r.name,
      email: r.email,
      phone: r.phone,
      orders: Number(r.orders_count),
      ltv: Number(r.ltv),
      status: r.status,
    })));
  } catch (err) {
    console.error("Customers error:", err);
    res.status(500).json({ error: "Failed to fetch customers" });
  }
});

// PATCH /api/customers/:email/status — toggle active/disabled access
app.patch("/api/customers/:email/status", requireDb, async (req, res) => {
  try {
    const { status } = req.body;
    if (!["active", "disabled"].includes(status)) {
      return res.status(400).json({ error: "Invalid status. Must be active or disabled" });
    }

    const result = await query(
      "UPDATE customers SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE LOWER(email) = LOWER($2) RETURNING *",
      [status, req.params.email]
    );

    if (result.rows.length === 0) {
      // If customer is not yet in table, insert them
      await query(
        "INSERT INTO customers (name, email, status) VALUES ($1, $2, $3)",
        [req.params.email.split("@")[0], req.params.email.toLowerCase(), status]
      );
    }

    res.json({ success: true, email: req.params.email, status });
  } catch (err) {
    console.error("Customer status update error:", err);
    res.status(500).json({ error: "Failed to update customer status" });
  }
});

// GET /api/customers/check-status — check if a customer is blocked before checkout
app.get("/api/customers/check-status", requireDb, async (req, res) => {
  try {
    const email = req.query.email;
    if (!email) return res.json({ allowed: true, status: "active" });

    const result = await query("SELECT status FROM customers WHERE LOWER(email) = LOWER($1)", [email.trim()]);
    if (result.rows.length > 0 && result.rows[0].status === "disabled") {
      return res.json({ allowed: false, status: "disabled", message: "This account has been disabled by store admin." });
    }

    res.json({ allowed: true, status: "active" });
  } catch (err) {
    console.error("Check status error:", err);
    res.json({ allowed: true, status: "active" });
  }
});

// =========================================================
// 7. ORDERS API
// =========================================================
app.get("/api/orders", requireDb, async (req, res) => {
  try {
    const result = await query("SELECT * FROM orders ORDER BY created_at DESC");
    res.json(result.rows.map(o => ({
      id: o.id,
      customer: o.customer_name,
      customerEmail: o.customer_email,
      customerPhone: o.customer_phone,
      shippingAddress: typeof o.shipping_address === "string" ? JSON.parse(o.shipping_address) : o.shipping_address,
      items: typeof o.items === "string" ? JSON.parse(o.items) : o.items,
      subtotal: Number(o.subtotal),
      shippingFee: Number(o.shipping_fee),
      codFee: Number(o.cod_fee),
      total: Number(o.total),
      pay: o.payment_method === "online" ? "Online / Razorpay" : "COD",
      paymentStatus: o.payment_status,
      status: o.status,
      date: new Date(o.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }),
      createdAt: o.created_at
    })));
  } catch (err) {
    console.error("Orders fetch error:", err);
    res.status(500).json({ error: "Failed to fetch orders" });
  }
});

// POST /api/orders — place an order (COD or post-verified online)
app.post("/api/orders", requireDb, async (req, res) => {
  try {
    const {
      id,
      customerName,
      customerEmail,
      customerPhone,
      shippingAddress,
      items,
      subtotal,
      shippingFee,
      codFee,
      discount,
      total,
      paymentMethod,
      paymentStatus,
      razorpayOrderId,
      razorpayPaymentId,
    } = req.body;

    // 1. Check if customer is blocked
    const custCheck = await query("SELECT status FROM customers WHERE LOWER(email) = LOWER($1)", [customerEmail.trim()]);
    if (custCheck.rows.length > 0 && custCheck.rows[0].status === "disabled") {
      return res.status(403).json({ error: "This customer account is disabled. Order cannot be placed." });
    }

    const orderId = id || `KC${Math.floor(100000 + Math.random() * 900000)}`;

    // 2. Insert order
    await query(
      `INSERT INTO orders (
        id, customer_name, customer_email, customer_phone, shipping_address,
        items, subtotal, shipping_fee, cod_fee, discount, total,
        payment_method, payment_status, razorpay_order_id, razorpay_payment_id, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)`,
      [
        orderId,
        customerName,
        customerEmail,
        customerPhone || null,
        JSON.stringify(shippingAddress || {}),
        JSON.stringify(items || []),
        Number(subtotal) || 0,
        Number(shippingFee) || 0,
        Number(codFee) || 0,
        Number(discount) || 0,
        Number(total) || 0,
        paymentMethod || "cod",
        paymentStatus || (paymentMethod === "online" ? "paid" : "pending"),
        razorpayOrderId || null,
        razorpayPaymentId || null,
        paymentStatus === "paid" ? "paid" : "pending",
      ]
    );

    // 3. Upsert customer stats (orders_count and ltv)
    await query(
      `INSERT INTO customers (name, email, phone, orders_count, ltv, status)
       VALUES ($1, $2, $3, 1, $4, 'active')
       ON CONFLICT (email) DO UPDATE SET
         name = EXCLUDED.name,
         phone = COALESCE(EXCLUDED.phone, customers.phone),
         orders_count = customers.orders_count + 1,
         ltv = customers.ltv + EXCLUDED.ltv,
         updated_at = CURRENT_TIMESTAMP`,
      [customerName, customerEmail.toLowerCase(), customerPhone || null, Number(total) || 0]
    );

    // 4. Update stock in inventory
    if (Array.isArray(items)) {
      for (const item of items) {
        if (item.productId) {
          await query(
            "UPDATE products SET stock = GREATEST(0, stock - $1) WHERE id = $2",
            [item.qty || 1, item.productId]
          );
        }
      }
    }

    res.status(201).json({
      success: true,
      orderId,
      message: "Order placed successfully in database",
    });
  } catch (err) {
    console.error("Order creation error:", err);
    res.status(500).json({ error: "Failed to save order" });
  }
});

// PATCH /api/orders/:id/status — update order fulfillment status
app.patch("/api/orders/:id/status", requireDb, async (req, res) => {
  try {
    const { status } = req.body;
    const result = await query(
      "UPDATE orders SET status = $1 WHERE id = $2 RETURNING *",
      [status, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Order not found" });
    }
    res.json({ success: true, order: result.rows[0] });
  } catch (err) {
    console.error("Order update error:", err);
    res.status(500).json({ error: "Failed to update order status" });
  }
});

// =========================================================
// 8. COUPONS API
// =========================================================
app.get("/api/coupons", requireDb, async (req, res) => {
  try {
    const result = await query("SELECT * FROM coupons ORDER BY code ASC");
    res.json(result.rows.map(c => ({
      code: c.code,
      discount: c.discount_label,
      type: c.discount_type,
      value: Number(c.discount_value),
      minOrder: Number(c.min_order),
      uses: `${c.current_uses} / ${c.max_uses ? c.max_uses : "∞"}`,
      expires: c.expires_at ? new Date(c.expires_at).toLocaleDateString("en-GB") : "Never",
      status: c.status
    })));
  } catch (err) {
    console.error("Coupons error:", err);
    res.status(500).json({ error: "Failed to fetch coupons" });
  }
});

app.post("/api/coupons", requireDb, async (req, res) => {
  try {
    const { code, discountLabel, discountType, discountValue, minOrder, maxUses, expiresAt } = req.body;
    await query(
      `INSERT INTO coupons (code, discount_label, discount_type, discount_value, min_order, max_uses, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [code.trim().toUpperCase(), discountLabel, discountType || "percent", discountValue || 0, minOrder || 0, maxUses || null, expiresAt || null]
    );
    res.status(201).json({ success: true, message: "Coupon created" });
  } catch (err) {
    console.error("Coupon creation error:", err);
    res.status(500).json({ error: "Failed to create coupon" });
  }
});

// POST /api/coupons/apply — validate coupon for cart
app.post("/api/coupons/apply", requireDb, async (req, res) => {
  try {
    const { code, cartTotal } = req.body;
    const result = await query("SELECT * FROM coupons WHERE UPPER(code) = UPPER($1)", [code.trim()]);
    if (result.rows.length === 0) {
      return res.status(404).json({ valid: false, error: "Coupon code not found" });
    }
    const c = result.rows[0];
    if (c.status === "expired" || (c.expires_at && new Date(c.expires_at) < new Date())) {
      return res.status(400).json({ valid: false, error: "Coupon has expired" });
    }
    if (c.max_uses && c.current_uses >= c.max_uses) {
      return res.status(400).json({ valid: false, error: "Coupon usage limit reached" });
    }
    if (cartTotal < Number(c.min_order)) {
      return res.status(400).json({ valid: false, error: `Minimum order of ₹${c.min_order} required` });
    }

    let discount = 0;
    if (c.discount_type === "percent") {
      discount = Math.round((cartTotal * Number(c.discount_value)) / 100);
    } else {
      discount = Number(c.discount_value);
    }

    res.json({
      valid: true,
      code: c.code,
      label: c.discount_label,
      discount: Math.min(discount, cartTotal),
    });
  } catch (err) {
    console.error("Coupon validate error:", err);
    res.status(500).json({ error: "Failed to apply coupon" });
  }
});

// =========================================================
// 9. REVIEWS API
// =========================================================
app.get("/api/reviews", requireDb, async (req, res) => {
  try {
    const { productId } = req.query;
    let sql = "SELECT * FROM reviews";
    const params = [];
    if (productId) {
      params.push(productId);
      sql += " WHERE product_id = $1";
    }
    sql += " ORDER BY created_at DESC";
    const result = await query(sql, params);
    res.json(result.rows.map(r => ({
      id: r.id,
      productId: r.product_id,
      product: r.product_name,
      customer: r.customer_name,
      rating: r.rating,
      comment: r.comment,
      status: r.status,
    })));
  } catch (err) {
    console.error("Reviews error:", err);
    res.status(500).json({ error: "Failed to fetch reviews" });
  }
});

app.post("/api/reviews", requireDb, async (req, res) => {
  try {
    const { productId, productName, customerName, rating, comment } = req.body;
    await query(
      `INSERT INTO reviews (product_id, product_name, customer_name, rating, comment, status)
       VALUES ($1, $2, $3, $4, $5, 'pending')`,
      [productId, productName, customerName, rating, comment]
    );
    res.status(201).json({ success: true, message: "Review submitted for moderation" });
  } catch (err) {
    console.error("Review submission error:", err);
    res.status(500).json({ error: "Failed to submit review" });
  }
});

app.patch("/api/reviews/:id/status", requireDb, async (req, res) => {
  try {
    const { status } = req.body;
    await query("UPDATE reviews SET status = $1 WHERE id = $2", [status, req.params.id]);
    res.json({ success: true, status });
  } catch (err) {
    console.error("Review moderation error:", err);
    res.status(500).json({ error: "Failed to update review" });
  }
});

// =========================================================
// 10. DASHBOARD ANALYTICS (REAL SQL AGGREGATIONS)
// =========================================================
app.get("/api/admin/stats", requireDb, async (req, res) => {
  try {
    // 30 days revenue & order count
    const ordersRes = await query(`
      SELECT 
        COUNT(*) as total_orders,
        COALESCE(SUM(total), 0) as total_revenue
      FROM orders
      WHERE created_at >= NOW() - INTERVAL '30 days'
    `);

    // Total customers
    const custRes = await query("SELECT COUNT(*) as total_customers FROM customers");

    // Low stock items (< 20 units)
    const lowStockRes = await query(`
      SELECT id, name, stock
      FROM products
      WHERE stock < 20
      ORDER BY stock ASC
    `);

    // Recent 5 orders
    const recentOrdersRes = await query(`
      SELECT id, customer_name as customer, jsonb_array_length(items) as items_count, total, status
      FROM orders
      ORDER BY created_at DESC
      LIMIT 5
    `);

    res.json({
      revenue30: Number(ordersRes.rows[0].total_revenue),
      orders30: Number(ordersRes.rows[0].total_orders),
      customersTotal: Number(custRes.rows[0].total_customers),
      lowStockCount: lowStockRes.rows.length,
      lowStockItems: lowStockRes.rows,
      recentOrders: recentOrdersRes.rows.map(o => ({
        id: o.id,
        customer: o.customer,
        items: o.items_count || 1,
        total: Number(o.total),
        status: o.status
      }))
    });
  } catch (err) {
    console.error("Stats calculation error:", err);
    res.status(500).json({ error: "Failed to calculate dashboard statistics" });
  }
});

// =========================================================
// 11. RAZORPAY PAYMENT ENDPOINTS
// =========================================================
app.post("/create-order", async (req, res) => {
  try {
    const { amountInRupees, receipt } = req.body;
    if (!amountInRupees || amountInRupees <= 0) {
      return res.status(400).json({ error: "Invalid amount" });
    }

    if (!razorpay) {
      // Return simulated order id if live razorpay secret is not yet configured
      return res.json({
        id: `order_mock_${Date.now()}`,
        amount: Math.round(amountInRupees * 100),
        currency: "INR",
        receipt: receipt || `order_${Date.now()}`,
      });
    }

    const order = await razorpay.orders.create({
      amount: Math.round(amountInRupees * 100), // paise
      currency: "INR",
      receipt: receipt || `order_${Date.now()}`,
    });
    res.json(order);
  } catch (err) {
    console.error("Razorpay create-order error:", err);
    res.status(500).json({ error: "Could not create Razorpay order" });
  }
});

app.post("/verify-payment", async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, order_data } = req.body;

    if (RAZORPAY_KEY_SECRET) {
      const expected = crypto
        .createHmac("sha256", RAZORPAY_KEY_SECRET)
        .update(`${razorpay_order_id}|${razorpay_payment_id}`)
        .digest("hex");

      if (expected !== razorpay_signature) {
        return res.status(400).json({ verified: false, error: "Invalid payment signature" });
      }
    }

    // Payment is authentic: update or record order in Postgres
    if (isDatabaseConfigured() && order_data) {
      await query(
        `UPDATE orders SET
          payment_status = 'paid',
          razorpay_payment_id = $1,
          razorpay_signature = $2,
          status = 'paid'
         WHERE id = $3 OR razorpay_order_id = $4`,
        [razorpay_payment_id, razorpay_signature, order_data.id, razorpay_order_id]
      );
    }

    res.json({ verified: true });
  } catch (err) {
    console.error("Razorpay verify-payment error:", err);
    res.status(500).json({ error: "Payment verification failed" });
  }
});

// Start the server
const port = process.env.PORT || 4000;
app.listen(port, () => {
  console.log(`\n  =================================================`);
  console.log(`  Krisin Clothing Store & Neon PostgreSQL Server`);
  console.log(`  =================================================\n`);
  console.log(`  ➜  Storefront:   http://localhost:${port}/`);
  console.log(`  ➜  Admin Panel:  http://localhost:${port}/admin/login.html`);
  console.log(`  ➜  Neon DB:      ${isDatabaseConfigured() ? "Connected ✓ (neondb)" : "Not configured"}`);
  console.log(`\n  Hold Ctrl and click any link above to open in your browser!\n`);
});
