/**
 * Neon PostgreSQL Initialization and Seed Script
 * 
 * Creates all tables from schema.sql and seeds:
 * - Default admin user (admin@krisin.clothing / krisin@admin1)
 * - Initial product categories
 * - Full 12-item Krisin product catalogue
 * - Sample customers
 * - Sample orders
 * - Sample coupons
 * - Sample reviews
 * 
 * Usage:
 *   cd server-example
 *   node init-db.js
 */

require("dotenv").config();
const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");
const { pool, query, isDatabaseConfigured } = require("./db");

const IMG = (id, w = 1200) => `https://images.unsplash.com/${id}?q=80&w=${w}&auto=format&fit=crop`;

const SEED_PRODUCTS = [
  {
    id: "mc-001",
    name: "Minimal Oversized Tee",
    category: "T-Shirts",
    price: 899,
    compareAt: null,
    colors: [
      { name: "Black", hex: "#161615" },
      { name: "Off-White", hex: "#e9e6e0" },
      { name: "Charcoal", hex: "#3a3835" }
    ],
    sizes: ["XS", "S", "M", "L", "XL"],
    outOfStock: ["XS"],
    stock: 42,
    images: [IMG("photo-1521572163474-6864f9cf17ab"), IMG("photo-1596755094514-f87e34085b2c")],
    description: "A heavyweight cotton tee cut with a relaxed, dropped shoulder for an easy silhouette. Garment-washed for a lived-in softness from the first wear.",
    fit: "Oversized fit. Model is 6'0\" wearing size M. Runs true to size with room through the body.",
    material: "100% combed cotton, 220 GSM. Pre-shrunk. Machine wash cold, inside out.",
    isNew: true,
    bestSeller: true
  },
  {
    id: "mc-002",
    name: "Essential Cotton Shirt",
    category: "Shirts",
    price: 1499,
    compareAt: null,
    colors: [
      { name: "White", hex: "#ffffff" },
      { name: "Light Gray", hex: "#c9c6c0" }
    ],
    sizes: ["S", "M", "L", "XL"],
    outOfStock: [],
    stock: 27,
    images: [IMG("photo-1541099649105-f69ad21f3246"), IMG("photo-1594938298603-c8148c4dae35")],
    description: "A clean, structured shirt built for every day, from desk to dinner. Mother-of-pearl buttons and a modern collar keep it sharp without trying too hard.",
    fit: "Regular fit through the chest, tapered waist. True to size.",
    material: "100% cotton poplin. Machine wash cold, tumble dry low.",
    isNew: false,
    bestSeller: true
  },
  {
    id: "mc-003",
    name: "Relaxed Fit Pants",
    category: "Pants",
    price: 1799,
    compareAt: 2199,
    colors: [
      { name: "Charcoal", hex: "#3a3835" },
      { name: "Black", hex: "#161615" }
    ],
    sizes: ["28", "30", "32", "34", "36"],
    outOfStock: ["28"],
    stock: 19,
    images: [IMG("photo-1594633312681-425c7b97ccd1"), IMG("photo-1552902865-b72c031ac5ea")],
    description: "Tapered through the leg with a relaxed rise, these pants move with you. A tonal drawcord and hidden pockets keep the front clean.",
    fit: "Relaxed through the hip and thigh, tapered ankle. Sits at the natural waist.",
    material: "97% cotton, 3% elastane twill. Machine wash cold.",
    isNew: false,
    bestSeller: true
  },
  {
    id: "mc-004",
    name: "Classic Pullover Hoodie",
    category: "Hoodies",
    price: 1999,
    compareAt: null,
    colors: [
      { name: "Black", hex: "#161615" },
      { name: "Off-White", hex: "#e9e6e0" }
    ],
    sizes: ["S", "M", "L", "XL", "XXL"],
    outOfStock: [],
    stock: 35,
    images: [IMG("photo-1620799140408-edc6dcb6d633"), IMG("photo-1490114538077-0a7f8cb49891")],
    description: "Our signature hoodie in brushed fleece, heavy enough to hold its shape and soft enough to live in. Ribbed cuffs and hem for a cleaner finish.",
    fit: "Regular fit, slightly dropped shoulder. True to size.",
    material: "80% cotton, 20% polyester fleece, 380 GSM.",
    isNew: true,
    bestSeller: true
  },
  {
    id: "mc-005",
    name: "Structured Overshirt",
    category: "Shirts",
    price: 1899,
    compareAt: null,
    colors: [{ name: "Charcoal", hex: "#3a3835" }],
    sizes: ["S", "M", "L", "XL"],
    outOfStock: [],
    stock: 14,
    images: [IMG("photo-1523381210434-271e8be1f52b"), IMG("photo-1556905055-8f358a7a47b2")],
    description: "A midweight overshirt that layers cleanly over a tee or under a coat. Corozo buttons and a boxy body for an easy, considered layer.",
    fit: "Boxy fit. Size down for a closer layer.",
    material: "100% brushed cotton twill.",
    isNew: true,
    bestSeller: false
  },
  {
    id: "mc-006",
    name: "Tapered Chino",
    category: "Pants",
    price: 1699,
    compareAt: null,
    colors: [
      { name: "Off-White", hex: "#e9e6e0" },
      { name: "Charcoal", hex: "#3a3835" }
    ],
    sizes: ["28", "30", "32", "34", "36"],
    outOfStock: [],
    stock: 22,
    images: [IMG("photo-1473966968600-fa801b869a1a"), IMG("photo-1517438476312-10d79c077509")],
    description: "A slim, tapered chino built in a stretch twill that holds a crease without restricting movement.",
    fit: "Slim through the thigh, tapered ankle.",
    material: "98% cotton, 2% elastane.",
    isNew: false,
    bestSeller: false
  },
  {
    id: "mc-007",
    name: "Round Acetate Sunglasses",
    category: "Glasses",
    price: 1299,
    compareAt: null,
    colors: [{ name: "Black", hex: "#161615" }, { name: "Tortoise", hex: "#6b4a2f" }],
    sizes: ["One Size"],
    outOfStock: [],
    stock: 30,
    images: [IMG("photo-1591047139829-d91aecb6caea"), IMG("photo-1483985988355-763728e1935b")],
    description: "Hand-finished acetate frames with UV400 lenses. A rounded silhouette that keeps the everyday edit sharp.",
    fit: "One size. 145mm temple length.",
    material: "Italian acetate frame, polarized UV400 lenses.",
    isNew: true,
    bestSeller: false
  },
  {
    id: "mc-008",
    name: "Wire Frame Glasses",
    category: "Glasses",
    price: 1099,
    compareAt: null,
    colors: [{ name: "Silver", hex: "#c9c6c0" }, { name: "Black", hex: "#161615" }],
    sizes: ["One Size"],
    outOfStock: [],
    stock: 18,
    images: [IMG("photo-1508296695146-257a814070b4"), IMG("photo-1508296695146-257a814070b4", 900)],
    description: "A featherlight wire frame with a slim keyhole bridge, quietly precise and built to disappear on the face.",
    fit: "One size. 140mm temple length.",
    material: "Stainless steel frame, polycarbonate lenses.",
    isNew: false,
    bestSeller: false
  },
  {
    id: "mc-009",
    name: "Leather Card Holder",
    category: "Accessories",
    price: 799,
    compareAt: null,
    colors: [{ name: "Black", hex: "#161615" }, { name: "Charcoal", hex: "#3a3835" }],
    sizes: ["One Size"],
    outOfStock: [],
    stock: 50,
    images: [IMG("photo-1553062407-98eeb64c6a62"), IMG("photo-1627123424574-724758594e93")],
    description: "Full-grain leather, cut and stitched to hold four cards and folded notes without bulk. Ages into its own patina.",
    fit: "One size, 9.5 x 7cm.",
    material: "Full-grain vegetable-tanned leather.",
    isNew: false,
    bestSeller: false
  },
  {
    id: "mc-010",
    name: "Ribbed Knit Beanie",
    category: "Accessories",
    price: 599,
    compareAt: null,
    colors: [{ name: "Black", hex: "#161615" }, { name: "Off-White", hex: "#e9e6e0" }],
    sizes: ["One Size"],
    outOfStock: [],
    stock: 40,
    images: [IMG("photo-1576871337622-98d48d1cf531"), IMG("photo-1576871337622-98d48d1cf531", 900)],
    description: "A close-ribbed beanie in a merino-cotton blend, cut with a shallow fold for a cleaner line than the usual slouch.",
    fit: "One size, fits most.",
    material: "70% cotton, 30% merino wool.",
    isNew: false,
    bestSeller: false
  },
  {
    id: "mc-011",
    name: "Boxy Crewneck Sweatshirt",
    category: "Hoodies",
    price: 1699,
    compareAt: null,
    colors: [{ name: "Light Gray", hex: "#c9c6c0" }, { name: "Black", hex: "#161615" }],
    sizes: ["S", "M", "L", "XL"],
    outOfStock: [],
    stock: 24,
    images: [IMG("photo-1620401537278-9c3ac0a09b02"), IMG("photo-1516257984-b1b4d707412e")],
    description: "A crewneck built boxy and cropped just slightly at the hem, in a fleece heavy enough to wear as an outer layer.",
    fit: "Boxy fit, dropped shoulder.",
    material: "85% cotton, 15% polyester fleece.",
    isNew: true,
    bestSeller: false
  },
  {
    id: "mc-012",
    name: "Slim Fit Poplin Shirt",
    category: "Shirts",
    price: 1399,
    compareAt: null,
    colors: [{ name: "White", hex: "#ffffff" }],
    sizes: ["S", "M", "L", "XL"],
    outOfStock: ["XL"],
    stock: 12,
    images: [IMG("photo-1602810318383-e386cc2a3ccf"), IMG("photo-1489987707025-afc232f7ea0f")],
    description: "A slim-cut poplin shirt with a clean spread collar, the one that goes under everything and stands alone just as well.",
    fit: "Slim fit. Size up for a more relaxed drape.",
    material: "100% cotton poplin.",
    isNew: false,
    bestSeller: false
  }
];

const SEED_CATEGORIES = ["T-Shirts", "Shirts", "Pants", "Hoodies", "Glasses", "Accessories"];

const SEED_CUSTOMERS = [
  { name: "Aarav Menon", email: "aarav.menon@example.com", phone: "+91 98765 43210", orders_count: 6, ltv: 18420, status: "active" },
  { name: "Sneha Pillai", email: "sneha.pillai@example.com", phone: "+91 98765 43211", orders_count: 2, ltv: 3998, status: "active" },
  { name: "Rahul Nair", email: "rahul.nair@example.com", phone: "+91 98765 43212", orders_count: 4, ltv: 9640, status: "active" },
  { name: "Divya Krishnan", email: "divya.k@example.com", phone: "+91 98765 43213", orders_count: 9, ltv: 27210, status: "active" },
  { name: "Kiran Das", email: "kiran.das@example.com", phone: "+91 98765 43214", orders_count: 1, ltv: 899, status: "active" }
];

const SEED_ORDERS = [
  {
    id: "MC10482",
    customer_name: "Aarav Menon",
    customer_email: "aarav.menon@example.com",
    customer_phone: "+91 98765 43210",
    shipping_address: { address: "Flat 402, Green Glen Layout, Bellandur", city: "Bengaluru", pincode: "560103", state: "Karnataka" },
    items: [
      { productId: "mc-001", name: "Minimal Oversized Tee", color: "Black", size: "M", qty: 2, price: 899 },
      { productId: "mc-003", name: "Relaxed Fit Pants", color: "Charcoal", size: "32", qty: 1, price: 1799 }
    ],
    subtotal: 3597,
    shipping_fee: 0,
    cod_fee: 0,
    discount: 0,
    total: 3597,
    payment_method: "online",
    payment_status: "paid",
    status: "paid",
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 1)
  },
  {
    id: "MC10481",
    customer_name: "Sneha Pillai",
    customer_email: "sneha.pillai@example.com",
    customer_phone: "+91 98765 43211",
    shipping_address: { address: "12 Marine Drive, Nariman Point", city: "Mumbai", pincode: "400021", state: "Maharashtra" },
    items: [
      { productId: "mc-004", name: "Classic Pullover Hoodie", color: "Off-White", size: "S", qty: 1, price: 1999 }
    ],
    subtotal: 1999,
    shipping_fee: 0,
    cod_fee: 49,
    discount: 0,
    total: 2048,
    payment_method: "cod",
    payment_status: "pending",
    status: "pending",
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2)
  },
  {
    id: "MC10480",
    customer_name: "Rahul Nair",
    customer_email: "rahul.nair@example.com",
    customer_phone: "+91 98765 43212",
    shipping_address: { address: "44 MG Road", city: "Kochi", pincode: "682016", state: "Kerala" },
    items: [
      { productId: "mc-002", name: "Essential Cotton Shirt", color: "White", size: "L", qty: 1, price: 1499 },
      { productId: "mc-007", name: "Round Acetate Sunglasses", color: "Black", size: "One Size", qty: 1, price: 1299 }
    ],
    subtotal: 2798,
    shipping_fee: 0,
    cod_fee: 0,
    discount: 100,
    total: 2698,
    payment_method: "online",
    payment_status: "paid",
    status: "paid",
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3)
  }
];

const SEED_COUPONS = [
  { code: "WELCOME10", discount_label: "10% off", discount_type: "percent", discount_value: 10, min_order: 999, max_uses: null, current_uses: 482, status: "ok" },
  { code: "FREESHIP", discount_label: "Free shipping", discount_type: "fixed", discount_value: 99, min_order: 0, max_uses: null, current_uses: 213, status: "ok" },
  { code: "FEST25", discount_label: "25% off", discount_type: "percent", discount_value: 25, min_order: 2500, max_uses: 500, current_uses: 97, status: "low" }
];

const SEED_REVIEWS = [
  { product_id: "mc-001", product_name: "Minimal Oversized Tee", customer_name: "Aarav Menon", rating: 5, comment: "Fits exactly as described, fabric feels premium.", status: "ok" },
  { product_id: "mc-004", product_name: "Classic Pullover Hoodie", customer_name: "Divya Krishnan", rating: 4, comment: "Great hoodie, wish it came in more colours.", status: "ok" },
  { product_id: "mc-003", product_name: "Relaxed Fit Pants", customer_name: "Rahul Nair", rating: 5, comment: "My new everyday pants. Perfect fit.", status: "pending" }
];

async function initializeDatabase() {
  console.log("=================================================");
  console.log("Krisin Clothing — Neon PostgreSQL Initialization");
  console.log("=================================================");

  if (!isDatabaseConfigured()) {
    console.error("ERROR: DATABASE_URL is not set or has placeholder in server-example/.env");
    console.log("Please add your Neon PostgreSQL connection string to server-example/.env:");
    console.log("DATABASE_URL=postgresql://user:password@ep-xyz.region.aws.neon.tech/neondb?sslmode=require\n");
    process.exit(1);
  }

  try {
    // 1. Run Schema SQL
    console.log("1. Applying database schema...");
    const schemaPath = path.join(__dirname, "schema.sql");
    const schemaSql = fs.readFileSync(schemaPath, "utf-8");
    await query(schemaSql);
    console.log("   ✓ Tables, indexes, and constraints created successfully.");

    // 2. Seed Default Admin User
    console.log("2. Checking Admin account...");
    const adminEmail = "admin@krisin.clothing";
    const existingAdmin = await query("SELECT * FROM admins WHERE email = $1", [adminEmail]);
    if (existingAdmin.rows.length === 0) {
      const passwordHash = await bcrypt.hash("krisin@admin1", 10);
      await query(
        "INSERT INTO admins (email, password_hash, name, role) VALUES ($1, $2, $3, $4)",
        [adminEmail, passwordHash, "Krisin Admin", "admin"]
      );
      console.log(`   ✓ Created default admin: ${adminEmail} (password: krisin@admin1)`);
    } else {
      console.log(`   ✓ Admin account already exists: ${adminEmail}`);
    }

    // 3. Seed Categories
    console.log("3. Seeding Categories...");
    for (const cat of SEED_CATEGORIES) {
      await query("INSERT INTO categories (name) VALUES ($1) ON CONFLICT (name) DO NOTHING", [cat]);
    }
    console.log(`   ✓ ${SEED_CATEGORIES.length} categories verified.`);

    // 4. Seed Products
    console.log("4. Seeding Products...");
    let productCount = 0;
    for (const p of SEED_PRODUCTS) {
      await query(
        `INSERT INTO products (
          id, name, category, price, compare_at, colors, sizes, out_of_stock,
          stock, images, description, fit, material, is_new, best_seller
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          category = EXCLUDED.category,
          price = EXCLUDED.price,
          compare_at = EXCLUDED.compare_at,
          stock = EXCLUDED.stock,
          updated_at = CURRENT_TIMESTAMP`,
        [
          p.id,
          p.name,
          p.category,
          p.price,
          p.compareAt,
          JSON.stringify(p.colors),
          JSON.stringify(p.sizes),
          JSON.stringify(p.outOfStock),
          p.stock,
          JSON.stringify(p.images),
          p.description,
          p.fit,
          p.material,
          p.isNew,
          p.bestSeller,
        ]
      );
      productCount++;
    }
    console.log(`   ✓ ${productCount} products seeded into Neon Postgres.`);

    // 5. Seed Customers
    console.log("5. Seeding Customers...");
    for (const c of SEED_CUSTOMERS) {
      await query(
        `INSERT INTO customers (name, email, phone, orders_count, ltv, status)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (email) DO NOTHING`,
        [c.name, c.email, c.phone, c.orders_count, c.ltv, c.status]
      );
    }
    console.log(`   ✓ ${SEED_CUSTOMERS.length} customers seeded.`);

    // 6. Seed Orders
    console.log("6. Seeding Orders...");
    for (const o of SEED_ORDERS) {
      await query(
        `INSERT INTO orders (
          id, customer_name, customer_email, customer_phone, shipping_address,
          items, subtotal, shipping_fee, cod_fee, discount, total,
          payment_method, payment_status, status, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        ON CONFLICT (id) DO NOTHING`,
        [
          o.id,
          o.customer_name,
          o.customer_email,
          o.customer_phone,
          JSON.stringify(o.shipping_address),
          JSON.stringify(o.items),
          o.subtotal,
          o.shipping_fee,
          o.cod_fee,
          o.discount,
          o.total,
          o.payment_method,
          o.payment_status,
          o.status,
          o.created_at
        ]
      );
    }
    console.log(`   ✓ ${SEED_ORDERS.length} sample orders seeded.`);

    // 7. Seed Coupons
    console.log("7. Seeding Coupons...");
    for (const cp of SEED_COUPONS) {
      await query(
        `INSERT INTO coupons (code, discount_label, discount_type, discount_value, min_order, max_uses, current_uses, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (code) DO NOTHING`,
        [cp.code, cp.discount_label, cp.discount_type, cp.discount_value, cp.min_order, cp.max_uses, cp.current_uses, cp.status]
      );
    }
    console.log(`   ✓ ${SEED_COUPONS.length} coupons seeded.`);

    // 8. Seed Reviews
    console.log("8. Seeding Reviews...");
    for (const r of SEED_REVIEWS) {
      const exist = await query(
        "SELECT id FROM reviews WHERE product_id = $1 AND customer_name = $2 LIMIT 1",
        [r.product_id, r.customer_name]
      );
      if (exist.rows.length === 0) {
        await query(
          `INSERT INTO reviews (product_id, product_name, customer_name, rating, comment, status)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [r.product_id, r.product_name, r.customer_name, r.rating, r.comment, r.status]
        );
      }
    }
    console.log(`   ✓ Reviews seeded.`);

    console.log("\n=================================================");
    console.log("Neon Postgres Database initialization COMPLETE!");
    console.log("=================================================\n");
  } catch (err) {
    console.error("Initialization failed:", err);
    process.exit(1);
  } finally {
    if (pool) {
      await pool.end();
    }
  }
}

if (require.main === module) {
  initializeDatabase();
}

module.exports = { initializeDatabase };
