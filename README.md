# Krisin Clothing — Website

A complete, production-grade e-commerce application for Krisin Clothing: home, shop with filters/sort,
product detail pages with variant switching and inventory checks, collections showcase, bag/cart, customer authentication, checkout with Razorpay and Cash on Delivery, about, contact, and store admin panel with backend session persistence.

## Running the Application

### 1. Start the Backend Server (Express + SQLite + Auth API)
```bash
cd server-example
npm install
npm start
```
*(Or use `nodemon server.js` for development with automatic restarts)*

The backend server runs on `http://localhost:4000`.
Since Express serves the frontend files from the parent directory, you can open:
**`http://localhost:4000`** directly in your browser.

*(If you run a separate frontend static server such as `npx http-server . -p 8000`, the frontend automatically communicates with the backend via CORS at `http://localhost:4000`)*.

---

## Features & Implementation Overview

### 1. Product Colour Selection & Variant Handling
- **Variant-Specific Photography**: Every product colour in `js/data.js` links to its exact high-resolution photograph.
- **Dynamic Swatch & Image Switching**: In `product.html`, clicking any colour swatch updates the active colour label, applies an active ring highlight, and updates the gallery image and thumbnails.
- **Variant-Specific Stock Availability**:
  - Size availability is validated per color variant (e.g. `XL` disabled and crossed out in Off-White).
  - Switching colours automatically adjusts to an in-stock size if the previously selected size is sold out in the newly selected color.
  - Quantity selectors prevent exceeding variant stock levels.
  - Sold-out variants disable Add to Cart and Buy Now buttons.
- **Cart Image Fidelity**: `STORE.addToCart` preserves the variant colour image, ensuring the bag drawer, cart page, and checkout summary show the chosen colour.

### 2. Navbar & Navigation
- **Shop**: `shop.html` displays all available products with category chips, sorting, and size/color/price filters.
- **New Arrivals**: `shop.html?filter=new` displays only products marked `isNew: true`.
- **Collections**:
  - `collections.html` showcases curated brand edits (*The Everyday Collection*, *Monochrome Essentials*, *Fall 2026 Lookbook*, and *Accessories & Accents*) with editorial descriptions and product cards.
  - `shop.html?collection=<id>` filters directly by collection.
- Responsive mobile menu drawer with complete navigation links.

### 3. Customer Authentication & Registration
- **Visible Navbar Options**: Navbar displays **Sign In** and **Sign Up** buttons for guests, and an account pill with customer name, bag link, and **Sign Out** for authenticated customers.
- **Dedicated Pages**: `login.html` and `register.html` designed matching the brand's luxury typography (`Fraunces` + `Work Sans`) and color tokens.
- **Backend & Database**:
  - Authentication powered by `bcryptjs` for secure password hashing and `jsonwebtoken` (JWT) for standard signed tokens.
  - SQLite database (`krisin.db`) persists users, account status (`active` vs `disabled`), and order history.
- **Validation**: Full client and server-side checks for email syntax, 10-digit mobile number, password length (min 6 characters), and matching password confirmation.

### 4. Login Required Before Purchasing
- **Guest Browsing**: Customers can browse, view details, select colours/sizes, and add products to the bag without logging in.
- **Checkout Guard**: Clicking **Buy Now** or proceeding to checkout redirects unauthenticated visitors to `login.html?redirect=checkout`.
- **Cart Preservation**: All selected items, colours, sizes, and quantities remain preserved in local storage.
- **Seamless Return**: After logging in or registering, customers return directly to `checkout.html` with their pre-filled customer details and full bag intact.
- **Backend Order Synchronization**: Authenticated orders are validated and saved in the SQLite `orders` table.

### 5. Admin Access & Session Persistence
- **Hiding Admin Links**: Admin link is removed from regular customer footers.
- **Session Persistence**: Admin login at `/admin/login.html` uses JWT tokens verified via `/api/admin/verify`. **Refreshing or reloading `admin/dashboard.html` does NOT log out the administrator.**
- **Admin Logout**: Clicking "Sign out" (`#a-logout-btn`) clears the session token and redirects to login.
- **Customer Access Toggle**: Admin dashboard customer toggle ("Allowed" / "Blocked") synchronizes with the backend database. Disabled accounts are prevented from logging in or purchasing.


- **Sample Customer:** Register a new customer via the **Sign Up** button on the store.

