# Krisin Clothing — Website

A complete front-end e-commerce build for Krisin Clothing: home, shop with filters/sort,
product pages, cart, checkout with live Razorpay payment, about, contact, and a store
admin panel.

## Opening it

No build step required.

```
cd krisin-clothing
python3 -m http.server 8000
```

Then visit `http://localhost:8000`. (Opening `index.html` directly by double-click also
works, but a local server avoids browser restrictions on some features.)

## What changed in this pass

Two real problems, both now fixed:

1. **Brand mismatch.** The site was built and styled as "Krishin" in black and a deep
   red — but your logo clearly reads **KRISIN**, in navy (`#14244b`) and gold
   (`#dfb052`). Every page, the admin panel, and the checkout modal now use the
   correct name and the colors pulled directly from your actual logo file (not
   guessed). Gold text was checked against WCAG contrast requirements and darkened
   where needed (sale prices, wishlist icon) so it stays legible on a light
   background — plain brand gold is used for badges and large fills instead, paired
   with navy text.
2. **The admin panel was mostly decorative.** "+ Add Product" didn't do anything,
   there was no way to edit a price, and there was no way to disable a customer's
   account. All three are now fully working — see "Admin panel" below.

Earlier typography fixes (sentence case, Fraunces + Work Sans, no em-dashes) and the
Razorpay integration carry over unchanged from the previous pass.

## Admin panel

Visit `admin/login.html` (there's also a "Store Admin" link in the homepage footer).

- **Demo sign-in:** `admin@krisin.clothing` / `krisin@admin1` — shown on the login
  screen itself. This check runs in the browser only; see "Before you go live" below.
- **Products:** add, edit or remove products from the **Products** tab. Editing a
  product is also how you change its price — click the pencil icon on any row, and
  the price field is right there in the form. Everything is written to the browser's
  `localStorage` as an overlay on top of `js/data.js`, so it survives a refresh, and
  it's what the Categories, Inventory and Dashboard tabs read from.
- **Customers:** the **Customers** tab has an Access toggle per person. Switching a
  customer to "Blocked" marks their account disabled everywhere in the admin UI; it's
  a real per-user localStorage flag, ready for a backend to actually enforce (see
  below — right now nothing stops a disabled customer from using the storefront itself,
  since the storefront doesn't check this flag yet).
- **Export CSV** on the Products tab downloads the current catalogue as a spreadsheet.
- **Coupons and Reviews** tabs are still read-only sample data, same as Orders — these
  need the backend below to become fully editable.

## Neon PostgreSQL Database & Backend

Krisin Clothing comes with full **Neon Serverless PostgreSQL** database integration.

### Quick Setup

1. **Create your free Neon project:**
   - Go to [neon.tech](https://neon.tech) and sign up / log in.
   - Click **Create Project** (e.g. named `krisin-clothing`).
   - Copy your connection string from the Neon dashboard. It looks like:
     ```
     postgresql://neondb_owner:YOUR_PASSWORD@ep-xyz.region.aws.neon.tech/neondb?sslmode=require
     ```

2. **Configure your environment:**
   - Open `server-example/.env`
   - Paste your connection string into `DATABASE_URL`:
     ```env
     DATABASE_URL=postgresql://neondb_owner:YOUR_PASSWORD@ep-xyz.region.aws.neon.tech/neondb?sslmode=require
     PORT=4000
     ```

3. **Verify the connection:**
   ```bash
   cd server-example
   npm run db:test
   ```

4. **Initialize tables & seed starter data:**
   ```bash
   npm run db:init
   ```
   This runs `schema.sql` to create all tables (admins, products, categories, customers, orders, coupons, reviews) and seeds the 12 Krisin products, default admin account, sample customers, and demo orders.

5. **Start the backend server:**
   ```bash
   npm start
   # or for auto-reloading dev mode:
   npm run dev
   ```

When the server is running on `http://localhost:4000`, the storefront and admin panel will automatically detect Neon Postgres, displaying a live green badge (`Neon Postgres (Live)`), writing orders directly to PostgreSQL, enforcing customer account blocking, and providing live dashboard stats!

If the backend server is stopped, the front end seamlessly falls back to local mode with zero downtime.

## Razorpay integration

`checkout.html` uses Razorpay's standard Checkout.js — the same integration method
used by most Indian D2C stores. Customers choose **Pay online with Razorpay** (card,
UPI, net banking, wallets — all inside Razorpay's own secure modal) or **Cash on
delivery**.

**It works right now in test mode.** The key in `checkout.html` —
`rzp_test_1DP5mmOlF5G5ag` — is Razorpay's own public sample test key from their
documentation, so you can click through the whole flow immediately. Use Razorpay's
test card/UPI details (see their docs) to simulate a real payment.

### Before you go live

1. **Create a Razorpay account** at dashboard.razorpay.com and complete KYC — this is
   required before you can accept real payments.
2. **Get your Key ID.** In the dashboard, go to *Settings → API Keys* and generate a
   key pair. Copy the **Key ID** (starts with `rzp_live_...` once you're live,
   `rzp_test_...` while testing with your own account).
3. **Replace the key.** Open `checkout.html`, find this line near the top of the last
   `<script>` block, and swap in your own Key ID:
   ```js
   const RAZORPAY_KEY_ID = "rzp_test_1DP5mmOlF5G5ag";
   ```
4. **Move order creation to a backend before launch.** This build calculates the
   amount in the browser and opens Razorpay's checkout directly with it — that's fine
   for testing, but a determined visitor could tamper with the amount client-side
   before a real payment. The fix Razorpay recommends is: your server calls the
   Razorpay Orders API to create an order for the exact amount, passes the returned
   `order_id` into the Checkout options instead of a raw `amount`, and then verifies
   the payment signature Razorpay sends back (in the `handler` response) using your
   **Key Secret** — which must never be placed in front-end code. A minimal
   Node/Express example for both steps is in `server-example/` if you'd like a
   starting point once you have hosting for a backend.
5. **Switch the theme color, name and logo** shown inside the Razorpay modal by
   editing the `name`, `image` and `theme.color` fields in the same script block, if
   you'd like to adjust them further.

## Structure

```
krisin-clothing/
├── index.html            Homepage
├── shop.html              Shop / catalogue with filters + sort
├── product.html            Product detail page (?id=mc-001 etc.)
├── cart.html                Shopping bag
├── checkout.html           Checkout, with live Razorpay payment
├── about.html                Brand story / founder page
├── contact.html               Contact page
├── css/style.css                All storefront styling (design tokens at the top)
├── js/data.js                     Product catalogue (12 sample products)
├── js/api.js                      API client connecting storefront & admin to Neon Postgres
├── js/main.js                     Cart, wishlist, header and drawer logic
├── assets/
│   ├── logo.png                   Full logo (icon + wordmark, original file)
│   ├── logo-icon.png              Deer icon only, navy — used as favicon
│   ├── logo-icon-white.png        Deer icon only, white — dark backgrounds
│   ├── logo-horizontal.png        Icon + wordmark, for light backgrounds
│   └── logo-horizontal-onDark.png Icon + wordmark, for navy/dark backgrounds
├── admin/
│   ├── login.html                 Admin sign-in gate (hashes & checks against Neon DB)
│   ├── dashboard.html             Store admin panel (live metrics, products, customers)
│   └── admin.css                  Admin-only styling
└── server-example/                Express backend with Neon Serverless Postgres
    ├── server.js                  REST API server (auth, products, orders, razorpay)
    ├── db.js                      Neon PostgreSQL connection pool (pg with SSL)
    ├── schema.sql                 Idempotent PostgreSQL table schema
    ├── init-db.js                 Database migration and starter seeder
    ├── test-connection.js         Neon connection testing script
    ├── package.json               NPM dependencies and run scripts
    ├── .env                       Local environment configuration
    └── .env.example               Environment template
```

## What's real vs. simulated

- **Neon Postgres Database:** Fully implemented with SQL schema, connection pooling, and automated seeding. Tables for products, categories, customers, orders, coupons, reviews, and admin auth.
- **Admin Authentication:** Admin passwords hashed with `bcrypt` and verified against the Neon database.
- **Customer Access Enforcement:** Disabled accounts toggled in the Admin Customers tab are checked at checkout; blocked customers cannot place orders.
- **Order Placement:** Orders placed via Cash on Delivery or Razorpay are recorded in the Neon Postgres database with line items and customer metrics.
- **Storefront & Admin Dual-Mode:** Automatically detects if Neon Postgres is connected. If offline or in static preview, gracefully falls back to `localStorage` and `js/data.js` without errors.
- **Product photography** uses royalty-free stock photography as a stand-in for real
  product shoots — swap the URLs in `js/data.js` for your own images whenever they're
  ready (any image host works; just drop the new URLs in), or add new products with
  your own image URLs directly from the admin panel.

## Customizing

- **Products:** edit `js/data.js` for the starting catalogue, or use the admin panel's
  Products tab for day-to-day add/edit/remove.
- **Colors, fonts, spacing:** edit the `:root` variables at the top of `css/style.css`.
- **Copy:** section headings and body copy live directly in each `.html` file.
- **Accent color:** `--accent` (`#dfb052`, the brand gold — badges and fills) and
  `--accent-text` (`#8a6318`, a darker gold used for text/icons so it stays readable
  on the cream background) in `css/style.css`.
