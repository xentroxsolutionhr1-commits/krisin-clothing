/* =========================================================
   KRISIN CLOTHING — Premium Animation Engine
   Scroll-reveal, stagger, progress bar, back-to-top,
   PDP reveal, image shimmer, cart row stagger
   ========================================================= */

(function () {
  "use strict";

  /* -------------------------------------------------------
     UTILITY: reduced-motion check
  ------------------------------------------------------- */
  const prefersReducedMotion = () =>
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* -------------------------------------------------------
     1. SCROLL PROGRESS BAR
  ------------------------------------------------------- */
  function initScrollProgressBar() {
    const bar = document.createElement("div");
    bar.className = "scroll-progress-bar";
    document.body.appendChild(bar);
    window.addEventListener("scroll", () => {
      const scrolled = window.scrollY;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      bar.style.width = max > 0 ? (scrolled / max * 100) + "%" : "0%";
    }, { passive: true });
  }

  /* -------------------------------------------------------
     2. BACK-TO-TOP BUTTON
  ------------------------------------------------------- */
  function initBackToTop() {
    const btn = document.createElement("button");
    btn.className = "back-to-top";
    btn.setAttribute("aria-label", "Back to top");
    btn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M12 19V5M5 12l7-7 7 7"/></svg>';
    document.body.appendChild(btn);

    window.addEventListener("scroll", () => {
      btn.classList.toggle("visible", window.scrollY > 400);
    }, { passive: true });

    btn.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
  }

  /* -------------------------------------------------------
     3. INTERSECTION OBSERVER — core reveal engine
  ------------------------------------------------------- */
  function buildObserver(rootMargin, threshold, callback) {
    return new IntersectionObserver(callback, {
      root: null,
      rootMargin: rootMargin || "0px 0px -60px 0px",
      threshold: threshold || 0
    });
  }

  /* -------------------------------------------------------
     4. SECTION HEADS
  ------------------------------------------------------- */
  function initSectionHeads() {
    const heads = document.querySelectorAll(".section-head");
    if (!heads.length) return;
    const obs = buildObserver("0px 0px -40px 0px", 0.1, entries => {
      entries.forEach(e => {
        if (e.isIntersecting) { e.target.classList.add("is-visible"); obs.unobserve(e.target); }
      });
    });
    heads.forEach(el => obs.observe(el));
  }

  /* -------------------------------------------------------
     5. GENERIC [data-reveal] ELEMENTS
  ------------------------------------------------------- */
  function initDataReveal() {
    const els = document.querySelectorAll("[data-reveal]");
    if (!els.length) return;
    const obs = buildObserver("0px 0px -60px 0px", 0, entries => {
      entries.forEach(e => {
        if (e.isIntersecting) { e.target.classList.add("is-visible"); obs.unobserve(e.target); }
      });
    });
    els.forEach(el => obs.observe(el));
  }

  /* -------------------------------------------------------
     6. STAGGER GROUPS  [data-reveal-group] > [data-stagger]
  ------------------------------------------------------- */
  function initRevealGroups() {
    const groups = document.querySelectorAll("[data-reveal-group]");
    if (!groups.length) return;
    const obs = buildObserver("0px 0px -40px 0px", 0.05, entries => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          const children = e.target.querySelectorAll("[data-stagger]");
          children.forEach((child, i) => child.style.setProperty("--stagger-i", i));
          e.target.classList.add("is-visible");
          obs.unobserve(e.target);
        }
      });
    });
    groups.forEach(g => obs.observe(g));
  }

  /* -------------------------------------------------------
     7. PRODUCT CARDS — staggered reveal by grid position
  ------------------------------------------------------- */
  function initProductCards() {
    const grids = document.querySelectorAll(".product-grid");
    if (!grids.length) return;

    const obs = buildObserver("0px 0px -30px 0px", 0, entries => {
      entries.forEach(e => {
        if (e.isIntersecting) { e.target.classList.add("is-visible"); obs.unobserve(e.target); }
      });
    });

    function observeCards(grid) {
      const cards = grid.querySelectorAll(".product-card");
      cards.forEach((card, i) => {
        card.style.setProperty("--card-i", i % 4); // reset per row
        obs.observe(card);
      });
    }

    grids.forEach(g => observeCards(g));

    // Re-observe when dynamically injected cards appear (shop/search filters)
    const mutObs = new MutationObserver(() => {
      grids.forEach(g => observeCards(g));
    });
    grids.forEach(g => mutObs.observe(g, { childList: true }));
  }

  /* -------------------------------------------------------
     8. CATEGORY BLOCKS
  ------------------------------------------------------- */
  function initCategoryBlocks() {
    const grid = document.querySelector(".category-grid");
    if (!grid) return;
    const blocks = grid.querySelectorAll(".category-block");
    blocks.forEach((b, i) => b.style.setProperty("--cat-i", i));

    const obs = buildObserver("0px 0px -20px 0px", 0.05, entries => {
      entries.forEach(e => {
        if (e.isIntersecting) { e.target.classList.add("is-visible"); obs.unobserve(e.target); }
      });
    });
    blocks.forEach(b => obs.observe(b));
  }

  /* -------------------------------------------------------
     9. LOOKBOOK ITEMS
  ------------------------------------------------------- */
  function initLookbookItems() {
    const grid = document.querySelector(".lookbook-grid");
    if (!grid) return;
    const items = grid.querySelectorAll(".look-item");
    items.forEach((it, i) => it.style.setProperty("--look-i", i));

    const obs = buildObserver("0px 0px -20px 0px", 0.05, entries => {
      entries.forEach(e => {
        if (e.isIntersecting) { e.target.classList.add("is-visible"); obs.unobserve(e.target); }
      });
    });
    items.forEach(it => obs.observe(it));
  }

  /* -------------------------------------------------------
     10. SPLIT SECTION (brand story / about)
  ------------------------------------------------------- */
  function initSplitSections() {
    const medias = document.querySelectorAll(".split-media");
    const texts  = document.querySelectorAll(".split-text");
    if (!medias.length) return;

    const obs = buildObserver("0px 0px -60px 0px", 0.1, entries => {
      entries.forEach(e => {
        if (e.isIntersecting) { e.target.classList.add("is-visible"); obs.unobserve(e.target); }
      });
    });

    medias.forEach(m => obs.observe(m));
    texts.forEach(t => obs.observe(t));
  }

  /* -------------------------------------------------------
     11. FEATURE BAND
  ------------------------------------------------------- */
  function initFeatureBand() {
    const bands = document.querySelectorAll(".feature-band");
    if (!bands.length) return;
    const obs = buildObserver("0px 0px -40px 0px", 0.05, entries => {
      entries.forEach(e => {
        if (e.isIntersecting) { e.target.classList.add("is-visible"); obs.unobserve(e.target); }
      });
    });
    bands.forEach(b => obs.observe(b));
  }

  /* -------------------------------------------------------
     12. FOOTER
  ------------------------------------------------------- */
  function initFooter() {
    const footer = document.querySelector(".site-footer");
    if (!footer) return;
    const obs = buildObserver("0px 0px 0px 0px", 0.05, entries => {
      entries.forEach(e => {
        if (e.isIntersecting) { e.target.classList.add("is-visible"); obs.unobserve(e.target); }
      });
    });
    obs.observe(footer);
  }

  /* -------------------------------------------------------
     13. PDP (product detail page)
  ------------------------------------------------------- */
  function initPDP() {
    const gallery = document.querySelector(".pdp-gallery");
    const info    = document.querySelector(".pdp-info");
    if (!gallery && !info) return;

    const obs = buildObserver("0px", 0.05, entries => {
      entries.forEach(e => {
        if (e.isIntersecting) { e.target.classList.add("is-visible"); obs.unobserve(e.target); }
      });
    });
    if (gallery) obs.observe(gallery);
    if (info)    obs.observe(info);
  }

  /* -------------------------------------------------------
     14. FILTER CHIPS — stagger by index
  ------------------------------------------------------- */
  function initFilterChips() {
    const chips = document.querySelectorAll(".filter-chip");
    chips.forEach((chip, i) => {
      chip.style.animationDelay = (i * 40 + 80) + "ms";
    });
  }

  /* -------------------------------------------------------
     15. IMAGE SHIMMER — add .loaded after onload
  ------------------------------------------------------- */
  function initImageShimmer() {
    document.querySelectorAll("img[loading='lazy'], img").forEach(img => {
      if (img.complete) {
        img.classList.add("loaded");
      } else {
        img.addEventListener("load", () => img.classList.add("loaded"), { once: true });
      }
    });
  }

  /* -------------------------------------------------------
     16. CART ROWS — stagger when drawer opens
  ------------------------------------------------------- */
  function initCartRowStagger() {
    // Watch for cart-row elements being added to the DOM
    const body = document.querySelector(".drawer-body");
    if (!body) return;
    const mutObs = new MutationObserver(() => {
      body.querySelectorAll(".cart-row").forEach((row, i) => {
        row.style.animationDelay = (i * 60 + 40) + "ms";
      });
    });
    mutObs.observe(body, { childList: true });
  }

  /* -------------------------------------------------------
     17. EXISTING [data-scroll-reveal] COMPAT
         (keep backward compat with old reveal system)
  ------------------------------------------------------- */
  function initLegacyScrollReveal() {
    const els = document.querySelectorAll("[data-scroll-reveal]:not(.product-card):not(.category-block):not(.look-item)");
    if (!els.length) return;
    const obs = buildObserver("0px 0px -60px 0px", 0.05, entries => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          e.target.classList.add("revealed");
          e.target.classList.add("is-visible");
          obs.unobserve(e.target);
        }
      });
    });
    els.forEach(el => obs.observe(el));
  }

  /* -------------------------------------------------------
     INIT ALL
  ------------------------------------------------------- */
  function init() {
    if (prefersReducedMotion()) {
      // Make everything instantly visible
      document.querySelectorAll(
        "[data-reveal], [data-reveal-group] > [data-stagger], .section-head, " +
        ".product-card, .category-block, .look-item, " +
        ".split-media, .split-text, .feature-band, .site-footer, " +
        ".pdp-gallery, .pdp-info"
      ).forEach(el => {
        el.classList.add("is-visible");
        el.style.opacity = "1";
        el.style.transform = "none";
      });
      return;
    }

    initScrollProgressBar();
    initBackToTop();
    initSectionHeads();
    initDataReveal();
    initRevealGroups();
    initProductCards();
    initCategoryBlocks();
    initLookbookItems();
    initSplitSections();
    initFeatureBand();
    initFooter();
    initPDP();
    initFilterChips();
    initImageShimmer();
    initCartRowStagger();
    initLegacyScrollReveal();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

})();
