/* =========================================================
   KRISIN CLOTHING — motion layer (booking + polish)
   Load as the last script on storefront pages (after main.js).
   It only watches and decorates: it never changes how the
   cart, checkout, payment, orders or login actually work.
   ========================================================= */
(function () {
  "use strict";
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const visible = (el) => !!el && el.offsetParent !== null;

  /* ---------- 1. Soft page transition on internal links ---------- */
  function setupPageTransitions() {
    if (reduce) return;
    document.addEventListener("click", (e) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = e.target.closest && e.target.closest("a[href]");
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const href = a.getAttribute("href");
      if (!href || href.startsWith("#") || /^(mailto|tel|javascript|whatsapp):/i.test(href)) return;
      let url;
      try { url = new URL(href, location.href); } catch (err) { return; }
      if (url.origin !== location.origin) return;
      if (url.pathname === location.pathname && url.search === location.search) return;
      e.preventDefault();
      document.documentElement.classList.add("km-leaving");
      setTimeout(() => { location.href = url.href; }, 200);
    });
    window.addEventListener("pageshow", () => document.documentElement.classList.remove("km-leaving"));
  }

  /* ---------- 2. Hero headline: lines rise out of a mask ---------- */
  function setupHeroLines() {
    if (reduce) return;
    const h1 = $(".hero-content h1");
    if (!h1 || h1.classList.contains("km-split")) return;
    const lines = h1.innerHTML.split(/<br\s*\/?>/i).map(s => s.trim()).filter(Boolean);
    if (!lines.length) return;
    h1.innerHTML = lines.map(l => `<span class="km-line"><span>${l}</span></span>`).join("");
    h1.classList.add("km-split");
  }

  /* ---------- 3. Bag count bounce + bag shake ---------- */
  function setupBadgeBump() {
    $$("[data-cart-count], [data-wish-count]").forEach(badge => {
      let prev = parseInt(badge.textContent, 10) || 0;
      new MutationObserver(() => {
        const n = parseInt(badge.textContent, 10) || 0;
        if (n > prev && !reduce) {
          badge.classList.remove("km-bump"); void badge.offsetWidth; badge.classList.add("km-bump");
          const btn = badge.closest(".icon-btn");
          if (btn && badge.hasAttribute("data-cart-count")) {
            btn.classList.remove("km-shake"); void btn.offsetWidth; btn.classList.add("km-shake");
          }
        }
        prev = n;
      }).observe(badge, { childList: true, characterData: true, subtree: true });
    });
  }

  /* ---------- 4. Product photo flies into the bag ---------- */
  function flyToBag(img) {
    if (reduce || !img) return;
    const bag = $$("[data-cart-open], .header-actions a[href*='cart']").find(visible);
    if (!bag) return;
    const from = img.getBoundingClientRect();
    if (!from.width || from.bottom < 0 || from.top > innerHeight) return;
    const to = bag.getBoundingClientRect();
    const size = Math.min(from.width, 220);
    const h = size * (from.height / from.width);
    const sx = from.left + (from.width - size) / 2, sy = from.top + (from.height - h) / 2;
    const clone = document.createElement("img");
    clone.src = img.currentSrc || img.src;
    clone.alt = "";
    clone.className = "km-fly";
    Object.assign(clone.style, { left: sx + "px", top: sy + "px", width: size + "px", height: h + "px" });
    document.body.appendChild(clone);
    const tx = to.left + to.width / 2, ty = to.top + to.height / 2;
    const dx = tx - (sx + size / 2), dy = ty - (sy + h / 2);
    const anim = clone.animate([
      { transform: "translate(0,0) scale(1) rotate(0)", opacity: 1 },
      { transform: `translate(${dx * 0.45}px, ${dy * 0.45 - 90}px) scale(.5) rotate(-6deg)`, opacity: 1, offset: 0.45 },
      { transform: `translate(${dx}px, ${dy}px) scale(.08) rotate(0)`, opacity: 0.5 }
    ], { duration: 900, easing: "cubic-bezier(.5,0,.3,1)" });
    anim.onfinish = () => {
      clone.remove();
      const ring = document.createElement("span");
      ring.className = "km-land";
      ring.style.left = tx + "px"; ring.style.top = ty + "px";
      document.body.appendChild(ring);
      setTimeout(() => ring.remove(), 650);
    };
  }

  // Confirm on the button itself: "✓ Added to bag" for a moment
  function confirmButton(btn) {
    if (!btn || btn.classList.contains("km-added")) return;
    const original = btn.innerHTML;
    btn.classList.add("km-added");
    btn.innerHTML = `<svg class="km-tick" viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>Added to bag`;
    setTimeout(() => {
      if (!btn.isConnected) return;
      btn.classList.remove("km-added");
      btn.innerHTML = original;
    }, 1600);
  }

  function setupAddToBag() {
    // capture phase: runs before the page's own click handler re-renders anything
    document.addEventListener("click", (e) => {
      const add = e.target.closest && e.target.closest("#add-to-cart");
      if (add && !add.disabled) {
        const img = $(".pdp-main-img img");
        // let the page add the item first, then celebrate
        setTimeout(() => {
          flyToBag(img);
          // the product page may re-render; find the current button
          confirmButton($("#add-to-cart"));
        }, 0);
        return;
      }
      const quick = e.target.closest && e.target.closest(".quick-add");
      if (quick) {
        const card = quick.closest(".product-card");
        flyToBag(card && card.querySelector(".product-media img"));
      }
    }, true);
  }

  // Product page: animate the main photo only when it actually changes
  function setupGallerySwap() {
    const root = $("#pdp-root") || $(".pdp");
    if (!root) return;
    let lastSrc = null;
    new MutationObserver(() => {
      const img = $(".pdp-main-img img", root);
      if (!img) return;
      const src = img.getAttribute("src");
      if (lastSrc !== null && src !== lastSrc && !reduce) img.classList.add("km-swap");
      lastSrc = src;
    }).observe(root, { childList: true, subtree: true });
  }

  /* ---------- 5. Buttons: ripple + loading spinner ---------- */
  function setupRipple() {
    if (reduce) return;
    document.addEventListener("pointerdown", (e) => {
      const btn = e.target.closest && e.target.closest(".btn, .a-btn");
      if (!btn || btn.disabled) return;
      const r = btn.getBoundingClientRect();
      const dot = document.createElement("span");
      dot.className = "km-ripple";
      dot.style.left = (e.clientX - r.left) + "px";
      dot.style.top = (e.clientY - r.top) + "px";
      btn.appendChild(dot);
      setTimeout(() => dot.remove(), 700);
    });
  }

  // A disabled button whose text ends in "…" / "..." is working: show a spinner
  const WORKING = /(…|\.\.\.)\s*$/;
  function syncLoading(btn) {
    const text = btn.textContent.trim();
    const working = btn.disabled && WORKING.test(text);
    const has = btn.classList.contains("km-loading");
    if (working && !btn.querySelector(".km-spin")) {
      btn.classList.add("km-loading");
      btn.insertAdjacentHTML("afterbegin", '<span class="km-spin" aria-hidden="true"></span>');
    } else if (!working && has) {
      btn.classList.remove("km-loading");
      const s = btn.querySelector(".km-spin");
      if (s) s.remove();
    }
  }
  function setupLoadingButtons() {
    const watch = (btn) => {
      if (btn.dataset.kmWatch) return;
      btn.dataset.kmWatch = "1";
      new MutationObserver(() => syncLoading(btn))
        .observe(btn, { attributes: true, attributeFilter: ["disabled"], childList: true, characterData: true, subtree: true });
      syncLoading(btn);
    };
    $$("button.btn, button.a-btn, .btn[type=submit]").forEach(watch);
    // buttons created later (product page renders its buttons with JS)
    new MutationObserver(muts => muts.forEach(m => m.addedNodes.forEach(n => {
      if (n.nodeType !== 1) return;
      if (n.matches && n.matches("button.btn, button.a-btn")) watch(n);
      n.querySelectorAll && n.querySelectorAll("button.btn, button.a-btn").forEach(watch);
    }))).observe(document.body, { childList: true, subtree: true });
  }

  /* ---------- 6. Checkout: confirming + order placed ---------- */
  function confetti() {
    if (reduce) return;
    const c = document.createElement("canvas");
    c.className = "km-confetti";
    document.body.appendChild(c);
    const ctx = c.getContext("2d");
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = c.width = innerWidth * dpr, H = c.height = innerHeight * dpr;
    const colors = ["#dfb052", "#f3d48f", "#14244b", "#b8863a", "#ffffff"];
    const parts = Array.from({ length: 140 }, (_, i) => {
      const fromLeft = i % 2 === 0;
      return {
        x: fromLeft ? W * 0.15 : W * 0.85, y: H * 0.45,
        vx: (fromLeft ? 1 : -1) * (4 + Math.random() * 9) * dpr,
        vy: (-10 - Math.random() * 10) * dpr,
        w: (6 + Math.random() * 6) * dpr, h: (3 + Math.random() * 4) * dpr,
        r: Math.random() * Math.PI, vr: (Math.random() - .5) * .3,
        color: colors[i % colors.length]
      };
    });
    const t0 = performance.now();
    (function frame(t) {
      const age = t - t0;
      ctx.clearRect(0, 0, W, H);
      parts.forEach(p => {
        p.vy += 0.35 * dpr; p.vx *= 0.985; p.x += p.vx; p.y += p.vy; p.r += p.vr;
        ctx.save();
        ctx.globalAlpha = Math.max(0, 1 - age / 3200);
        ctx.translate(p.x, p.y); ctx.rotate(p.r);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      });
      if (age < 3300) requestAnimationFrame(frame); else c.remove();
    })(t0);
  }

  function celebrate(box) {
    if (box.dataset.kmCelebrated) return;
    box.dataset.kmCelebrated = "1";
    box.classList.add("km-celebrate");
    box.insertAdjacentHTML("afterbegin", `
      <svg class="km-success-mark" viewBox="0 0 100 100" aria-hidden="true">
        <circle cx="50" cy="50" r="45"/>
        <circle class="fill" cx="50" cy="50" r="38"/>
        <path d="M33 51l11 11 23-24"/>
      </svg>`);
    setTimeout(confetti, 900);
  }

  function setupCheckout() {
    const box = $("#confirmation");
    const payBtn = $("#pay-cta");
    if (!box && !payBtn) return;

    // Order placed: tick + confetti the moment the confirmation appears
    if (box) {
      const check = () => {
        if (!box.classList.contains("hidden") && visible(box)) {
          celebrate(box);
          if (window.KrisinLogo) KrisinLogo.hide(600);
        }
      };
      new MutationObserver(check).observe(box, { attributes: true, attributeFilter: ["class", "style"] });
      check();
    }

    // Payment done, server confirming: show the brand logo while we wait
    if (payBtn && window.KrisinLogo) {
      let showing = false;
      new MutationObserver(() => {
        const text = payBtn.textContent.trim().toLowerCase();
        if (!showing && payBtn.disabled && text.startsWith("verifying payment")) {
          showing = true;
          KrisinLogo.show({ message: "Confirming your order", waiting: true });
        } else if (showing && !payBtn.disabled) {
          showing = false;
          KrisinLogo.hide(600);
        }
      }).observe(payBtn, { attributes: true, attributeFilter: ["disabled"], childList: true, characterData: true, subtree: true });
      // if the page shows an alert/error instead, never leave the logo up
      window.addEventListener("focus", () => { if (showing && !payBtn.disabled) { showing = false; KrisinLogo.hide(0); } });
    }
  }

  /* ---------- 7. Light that follows the cursor over product photos ---------- */
  function setupCardLight() {
    if (!finePointer || reduce) return;
    document.addEventListener("mousemove", (e) => {
      const media = e.target.closest && e.target.closest(".product-media");
      if (!media) return;
      const r = media.getBoundingClientRect();
      media.style.setProperty("--mx", (e.clientX - r.left) + "px");
      media.style.setProperty("--my", (e.clientY - r.top) + "px");
    }, { passive: true });
  }

  function init() {
    const steps = [setupPageTransitions, setupHeroLines, setupBadgeBump, setupAddToBag, setupGallerySwap,
      setupRipple, setupLoadingButtons, setupCheckout, setupCardLight];
    steps.forEach(fn => { try { fn(); } catch (err) { console.warn("motion:", fn.name, err); } });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
