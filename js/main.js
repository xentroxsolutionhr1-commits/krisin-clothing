/* =========================================================
   KRISIN CLOTHING — shared front-end logic
   Cart & wishlist persist in localStorage (client-only demo;
   a production build would sync this through the store API).
   ========================================================= */

const STORE = {
  cartKey: "mc_cart",
  wishKey: "mc_wishlist",

  getCart() {
    try { return JSON.parse(localStorage.getItem(this.cartKey)) || []; }
    catch (e) { return []; }
  },
  saveCart(cart) {
    localStorage.setItem(this.cartKey, JSON.stringify(cart));
    updateHeaderCounts();
  },
  addToCart(productId, color, size, qty = 1) {
    const cart = this.getCart();
    const existing = cart.find(i => i.productId === productId && i.color === color && i.size === size);
    if (existing) existing.qty += qty;
    else cart.push({ productId, color, size, qty });
    this.saveCart(cart);
  },
  removeFromCart(index) {
    const cart = this.getCart();
    cart.splice(index, 1);
    this.saveCart(cart);
  },
  setQty(index, qty) {
    const cart = this.getCart();
    if (!cart[index]) return;
    cart[index].qty = Math.max(1, qty);
    this.saveCart(cart);
  },
  cartCount() {
    return this.getCart().reduce((sum, i) => sum + i.qty, 0);
  },
  cartTotal() {
    return this.getCart().reduce((sum, i) => {
      const p = getProduct(i.productId);
      return p ? sum + p.price * i.qty : sum;
    }, 0);
  },

  getWishlist() {
    try { return JSON.parse(localStorage.getItem(this.wishKey)) || []; }
    catch (e) { return []; }
  },
  toggleWishlist(productId) {
    let wish = this.getWishlist();
    if (wish.includes(productId)) wish = wish.filter(id => id !== productId);
    else wish.push(productId);
    localStorage.setItem(this.wishKey, JSON.stringify(wish));
    updateHeaderCounts();
    return wish.includes(productId);
  },
  isWishlisted(productId) {
    return this.getWishlist().includes(productId);
  }
};

/* ---------- Header counts ---------- */
function updateHeaderCounts() {
  document.querySelectorAll("[data-cart-count]").forEach(el => {
    const n = STORE.cartCount();
    el.textContent = n;
    el.classList.toggle("hidden", n === 0);
  });
  document.querySelectorAll("[data-wish-count]").forEach(el => {
    const n = STORE.getWishlist().length;
    el.textContent = n;
    el.classList.toggle("hidden", n === 0);
  });
}

/* ---------- Toast ---------- */
let toastTimer;
function showToast(message) {
  let toast = document.querySelector(".toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.className = "toast";
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2400);
}

/* ---------- Product card markup ---------- */
function productCardHTML(p) {
  const wished = STORE.isWishlisted(p.id);
  const tag = p.isNew ? '<span class="stock-tag">New</span>'
    : (p.outOfStock.length === p.sizes.length ? '<span class="stock-tag">Sold out</span>'
      : (p.compareAt ? '<span class="stock-tag sale">Sale</span>' : ""));
  const priceHTML = p.compareAt
    ? `<del>${formatPrice(p.compareAt)}</del><span class="sale-price">${formatPrice(p.price)}</span>`
    : formatPrice(p.price);
  return `
  <div class="product-card" data-product-id="${p.id}">
    <a href="product.html?id=${p.id}" aria-label="${p.name}">
      <div class="product-media">
        ${tag}
        <button class="wish-toggle ${wished ? "active" : ""}" data-wish="${p.id}" aria-label="Toggle wishlist" onclick="event.preventDefault();handleWishClick(this,'${p.id}')">
          <svg viewBox="0 0 24 24"><path d="M12 21s-7.5-4.6-10-9.2C.4 8.4 2 4.5 6 4c2.4-.3 4.2 1 6 3 1.8-2 3.6-3.3 6-3 4 .5 5.6 4.4 4 7.8C19.5 16.4 12 21 12 21z"/></svg>
        </button>
        <img class="img-a" src="${p.images[0]}" alt="${p.name}" loading="lazy">
        <img class="img-b" src="${p.images[1] || p.images[0]}" alt="" loading="lazy">
      </div>
      <div class="product-info">
        <span class="name">${p.name}</span>
        <span class="price mono-price">${priceHTML}</span>
        <div class="swatches">
          ${p.colors.map(c => `<span class="swatch" style="background:${c.hex}" title="${c.name}"></span>`).join("")}
        </div>
      </div>
    </a>
  </div>`;
}

function handleWishClick(btn, id) {
  const active = STORE.toggleWishlist(id);
  btn.classList.toggle("active", active);
  showToast(active ? "Added to wishlist" : "Removed from wishlist");
}

function renderProductGrid(container, products) {
  if (!container) return;
  container.innerHTML = products.map(productCardHTML).join("") ||
    `<p class="sub">No products match these filters.</p>`;
}

/* ---------- Header behavior (scroll + mobile menu + search) ---------- */
function initHeader() {
  const header = document.querySelector(".site-header");
  if (header) {
    const onScroll = () => header.classList.toggle("is-compact", window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  const toggle = document.querySelector(".menu-toggle");
  const mobileNav = document.querySelector(".mobile-nav");
  if (toggle && mobileNav) {
    toggle.addEventListener("click", () => mobileNav.classList.toggle("open"));
    mobileNav.querySelectorAll("a").forEach(a => a.addEventListener("click", () => mobileNav.classList.remove("open")));
    const closeBtn = mobileNav.querySelector(".mobile-nav-close");
    if (closeBtn) closeBtn.addEventListener("click", () => mobileNav.classList.remove("open"));
  }

  const searchBtn = document.querySelector("[data-search-toggle]");
  const searchBar = document.querySelector(".search-bar");
  if (searchBtn && searchBar) {
    searchBtn.addEventListener("click", () => {
      searchBar.classList.toggle("open");
      if (searchBar.classList.contains("open")) searchBar.querySelector("input").focus();
    });
    const searchInput = searchBar.querySelector("input");
    if (searchInput) {
      searchInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && searchInput.value.trim()) {
          window.location.href = `shop.html?q=${encodeURIComponent(searchInput.value.trim())}`;
        }
      });
    }
  }

  updateHeaderCounts();
  initCartDrawer();
}

/* ---------- Mini cart drawer ---------- */
function initCartDrawer() {
  const overlay = document.querySelector(".drawer-overlay");
  const drawer = document.querySelector(".cart-drawer");
  const openTriggers = document.querySelectorAll("[data-cart-open]");
  const closeTriggers = document.querySelectorAll("[data-cart-close]");
  if (!drawer || !overlay) return;

  function open() { renderDrawer(); drawer.classList.add("open"); overlay.classList.add("open"); document.body.style.overflow = "hidden"; }
  function close() { drawer.classList.remove("open"); overlay.classList.remove("open"); document.body.style.overflow = ""; }

  openTriggers.forEach(el => el.addEventListener("click", (e) => { e.preventDefault(); open(); }));
  closeTriggers.forEach(el => el.addEventListener("click", close));
  overlay.addEventListener("click", close);

  window._openCartDrawer = open;
}

function renderDrawer() {
  const body = document.querySelector(".drawer-body");
  const footTotal = document.querySelector("[data-drawer-total]");
  if (!body) return;
  const cart = STORE.getCart();
  if (cart.length === 0) {
    body.innerHTML = `<div class="empty-state"><p class="sub">Your bag is empty.</p></div>`;
  } else {
    body.innerHTML = cart.map((item, i) => {
      const p = getProduct(item.productId);
      if (!p) return "";
      return `
      <div class="cart-row">
        <img src="${p.images[0]}" alt="${p.name}">
        <div>
          <div class="name">${p.name}</div>
          <div class="meta">${item.color}, size ${item.size}, qty ${item.qty}</div>
          <button class="cart-remove" onclick="STORE.removeFromCart(${i});renderDrawer();">Remove</button>
        </div>
        <div class="price mono-price">${formatPrice(p.price * item.qty)}</div>
      </div>`;
    }).join("");
  }
  if (footTotal) footTotal.textContent = formatPrice(STORE.cartTotal());
}

/* ---------- Hero Carousel ---------- */
function initCarousel() {
  const carousel = document.getElementById('hero-carousel');
  if (!carousel) return;

  const slides = carousel.querySelectorAll('.carousel-slide');
  const dots = carousel.querySelectorAll('.carousel-dot');
  const prevBtn = carousel.querySelector('.carousel-prev');
  const nextBtn = carousel.querySelector('.carousel-next');
  const progressBar = carousel.querySelector('.carousel-progress-bar');

  if (slides.length === 0) return;

  let current = 0;
  let autoplayTimer = null;
  const INTERVAL = 3000;
  let isPaused = false;

  function goTo(index) {
    // Update current index within bounds
    current = (index + slides.length) % slides.length;

    // Update active dot
    dots.forEach(d => d.classList.remove('active'));
    dots[current].classList.add('active');

    // Move the track to show the correct slide
    const track = carousel.querySelector('.carousel-track');
    if (track) {
      track.style.transform = `translateX(${-current * 100}%)`;
    }

    // Update slide active classes for zoom effect
    slides.forEach(s => s.classList.remove('active'));
    slides[current].classList.add('active');

    resetProgress();
  }

  function next() { goTo(current + 1); }
  function prev() { goTo(current - 1); }

  function startAutoplay() {
    // Ensure any previous interval is cleared
    if (autoplayTimer) clearInterval(autoplayTimer);
    autoplayTimer = setInterval(next, INTERVAL);
    // Restart progress bar animation
    if (progressBar) {
      progressBar.classList.remove('animating');
      void progressBar.offsetWidth;
      progressBar.style.animationDuration = `${INTERVAL}ms`;
      progressBar.classList.add('animating');
    }
  }

  function stopAutoplay() {
    if (autoplayTimer) clearInterval(autoplayTimer);
    if (progressBar) progressBar.style.animationPlayState = 'paused';
  }

  function resetProgress() {
    // Called after each manual navigation to sync the interval and progress bar
    stopAutoplay();
    startAutoplay();
  }

  // Event listeners
  if (prevBtn) prevBtn.addEventListener('click', () => { prev(); });
  if (nextBtn) nextBtn.addEventListener('click', () => { next(); });

  dots.forEach(dot => {
    dot.addEventListener('click', () => {
      const idx = parseInt(dot.dataset.slide, 10);
      if (idx !== current) goTo(idx);
    });
  });

  // Pause on hover
  carousel.addEventListener('mouseenter', () => {
    isPaused = true;
    stopAutoplay();
    if (progressBar) progressBar.style.animationPlayState = 'paused';
  });

  carousel.addEventListener('mouseleave', () => {
    isPaused = false;
    if (progressBar) progressBar.style.animationPlayState = 'running';
    startAutoplay();
  });

  // Touch/swipe support
  let touchStartX = 0;
  let touchEndX = 0;
  carousel.addEventListener('touchstart', (e) => {
    touchStartX = e.changedTouches[0].screenX;
  }, { passive: true });
  carousel.addEventListener('touchend', (e) => {
    touchEndX = e.changedTouches[0].screenX;
    const diff = touchStartX - touchEndX;
    if (Math.abs(diff) > 50) {
      diff > 0 ? next() : prev();
    }
  }, { passive: true });

  // Keyboard support
  carousel.setAttribute('tabindex', '0');
  carousel.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') prev();
    if (e.key === 'ArrowRight') next();
  });

  // Initialize track position
  const track = carousel.querySelector('.carousel-track');
  if (track) {
    track.style.transform = 'translateX(0%)';
  }

  // Start autoplay on load
  startAutoplay();
}

/* ---------- Scroll Reveal Animations ---------- */
function initScrollReveal() {
  const revealElements = document.querySelectorAll('[data-scroll-reveal]');
  const footer = document.querySelector('.site-footer');

  if (!revealElements.length && !footer) return;

  // Respect prefers-reduced-motion
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    revealElements.forEach(el => el.classList.add('revealed'));
    if (footer) footer.classList.add('revealed');
    return;
  }

  const observerOptions = {
    root: null,
    rootMargin: '0px 0px -80px 0px',
    threshold: 0.1
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('revealed');
        observer.unobserve(entry.target);
      }
    });
  }, observerOptions);

  revealElements.forEach(el => observer.observe(el));

  // Footer
  if (footer) {
    const footerObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('revealed');
          footerObserver.unobserve(entry.target);
        }
      });
    }, { root: null, rootMargin: '0px', threshold: 0.05 });

    footerObserver.observe(footer);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  initHeader();
  initCarousel();
  initScrollReveal();
});
