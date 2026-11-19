# Animations added (Nov 2026)

New files:
- `css/logo-loader.css`, `js/logo-loader.js`: animated KRISIN logo.
  - Opening splash on the first page of each visit (ring draws, deer rises
    with a gold shine, wordmark wipes in).
  - Customer sign-in and register: "Signing you in" / "Creating your account".
    The next page shows "Welcome back". With a wrong password, the logo steps
    aside and your error message shows.
  - Admin login (`/admin05/login`) plays it in full, then lifts away on the dashboard.
- `css/motion.css`, `js/motion.js`: booking and site animations.
  - Add to cart: the photo flies into the bag, the button shows "✓ Added to bag",
    and the bag count bounces.
  - Buttons show a spinner while working ("Signing in…", "Creating secure
    payment...", "Opening checkout…").
  - Checkout: animated steps. The KRISIN logo shows "Confirming your order" while
    the payment is verified. The order confirmation gets an animated tick and
    gold confetti.
  - Hero headline rises line by line, header slides in, pages fade between
    each other, gold ripple on button clicks, cursor light on product photos,
    order cards rise in on My Orders.
  - Fix: header search and bag icons were half size on every page.

Page changes: each storefront page got 2 stylesheet lines and 2 script lines.
`index.html` also now loads the existing `css/animations.css` and `js/animations.js`
(it was the only page without them). `admin/login.html` waits for the logo before
opening the dashboard. No cart, checkout, payment, order or login logic was changed.

Everything switches off for visitors who have "reduce motion" turned on.
