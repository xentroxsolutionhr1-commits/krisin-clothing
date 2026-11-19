/* =========================================================
   KRISIN CLOTHING — animated logo (opening splash + login)
   Pair with css/logo-loader.css.

   Place the script tag right after <body> so the splash
   covers the page before anything else is painted:
       <script src="js/logo-loader.js" data-splash></script>
   (data-splash = show the opening animation on the first page
   of each visit. Leave it off on pages that shouldn't splash.)

   API:
     KrisinLogo.show({ message, waiting, static }) -> Promise (intro done)
     KrisinLogo.setMessage(text)
     KrisinLogo.hide()                              -> lifts the overlay
     KrisinLogo.handoff(played)                     -> next page opens with the logo

   Login forms are picked up automatically: a form with a password
   field shows the logo while signing in, says "Welcome back" on the
   next page, and steps aside if the sign-in fails. Add
   data-logo-manual to a <form> to handle it yourself, or
   data-logo-message="..." to change the wording.
   ========================================================= */
(function () {
  "use strict";
  if (window.KrisinLogo) return;

  const me = document.currentScript;
  const ASSETS = me && me.src ? new URL("../assets/", me.src).href : "/assets/";
  const ICON = ASSETS + "logo-icon-white.png";
  const WORD = ASSETS + "logo-wordmark-onDark.png";
  const HANDOFF_KEY = "krisin_logo_handoff";
  const SEEN_KEY = "krisin_splash_seen";
  const INTRO_MS = 2100;
  const root = document.documentElement;
  const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const esc = (s) => String(s == null ? "" : s).replace(/[<>&"]/g, c => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c]));

  function markup(message) {
    return `
      <div class="klogo-stage">
        <div class="klogo-mark">
          <svg class="klogo-ring" viewBox="0 0 168 168" aria-hidden="true">
            <circle class="track" cx="84" cy="84" r="82"/>
            <circle class="draw" cx="84" cy="84" r="82"/>
            <circle class="orbit" cx="84" cy="84" r="82"/>
            <circle class="dot" cx="166" cy="84" r="2.6"/>
          </svg>
          <div class="klogo-icon">
            <img src="${ICON}" alt="">
            <span class="klogo-shine" style="--klogo-mask:url('${ICON}')"></span>
          </div>
        </div>
        <div class="klogo-word"><img src="${WORD}" alt="Krisin Clothing"></div>
        <p class="klogo-msg">${esc(message)}</p>
      </div>`;
  }

  let overlay = null;
  let shownAt = 0;

  function mount(el) {
    // body may not exist yet if the script was put in <head>
    if (document.body) document.body.appendChild(el);
    else document.addEventListener("DOMContentLoaded", () => document.body.appendChild(el), { once: true });
  }

  function show(opts = {}) {
    hideNow();
    overlay = document.createElement("div");
    overlay.className = "klogo-overlay" + (opts.waiting ? " waiting" : "") + (opts.static ? " static" : "");
    overlay.setAttribute("role", "status");
    overlay.setAttribute("aria-live", "polite");
    overlay.innerHTML = markup(opts.message);
    root.classList.add("klogo-busy");
    mount(overlay);
    shownAt = performance.now();
    return new Promise(res => setTimeout(res, opts.static || reduce ? 0 : INTRO_MS));
  }

  function setMessage(text) {
    const m = overlay && overlay.querySelector(".klogo-msg");
    if (m) m.textContent = text;
  }

  // Lift the overlay away, but never cut the intro short
  function hide(minShowMs = 1500) {
    if (!overlay) { root.classList.remove("klogo-busy"); return Promise.resolve(); }
    const el = overlay;
    overlay = null;
    const wait = el.classList.contains("static") || reduce ? 0 : Math.max(0, minShowMs - (performance.now() - shownAt));
    return new Promise(res => setTimeout(() => {
      el.classList.add("leave");
      // let the page's held entrance animations start as the curtain rises
      setTimeout(() => root.classList.remove("klogo-busy"), 250);
      setTimeout(() => { el.remove(); res(); }, 1000);
    }, wait));
  }
  function hideNow() { if (overlay) { overlay.remove(); overlay = null; } }

  // played = the full intro was already seen on the page before
  function handoff(played = true) {
    try { sessionStorage.setItem(HANDOFF_KEY, JSON.stringify({ t: Date.now(), played: !!played })); } catch (e) {}
  }
  function takeHandoff() {
    try {
      const raw = sessionStorage.getItem(HANDOFF_KEY);
      sessionStorage.removeItem(HANDOFF_KEY);
      if (!raw) return null;
      const h = JSON.parse(raw);
      if (!h || Date.now() - h.t > 20000) return null;
      return h;
    } catch (e) { return null; }
  }
  function clearHandoff() { try { sessionStorage.removeItem(HANDOFF_KEY); } catch (e) {} }

  /* ---------- Automatic login animation ---------- */
  let navigating = false;
  window.addEventListener("beforeunload", () => { navigating = true; });
  window.addEventListener("pagehide", () => { navigating = true; });
  window.addEventListener("pageshow", (e) => {
    // back/forward cache: never come back to a stuck overlay
    navigating = false;
    if (e.persisted) { hideNow(); root.classList.remove("klogo-busy"); }
  });

  function visibleError(scope) {
    return [...scope.querySelectorAll('[class*="error"], [class*="alert"], [id*="error"], [role="alert"]')]
      .filter(el => !el.closest(".klogo-overlay"))
      .some(el => el.offsetParent !== null && el.textContent.trim().length > 0 &&
        getComputedStyle(el).visibility !== "hidden" && getComputedStyle(el).opacity !== "0");
  }
  function loginMessage(form) {
    if (form.dataset.logoMessage) return form.dataset.logoMessage;
    const id = ((form.id || "") + " " + (form.className || "") + " " + location.pathname).toLowerCase();
    if (/register|signup|sign-up/.test(id)) return "Creating your account";
    if (/login|signin|sign-in/.test(id)) return "Signing you in";
    return null; // e.g. password reset forms: no logo
  }

  document.addEventListener("submit", (e) => {
    const form = e.target;
    if (!(form instanceof HTMLFormElement) || form.hasAttribute("data-logo-manual")) return;
    if (!form.querySelector('input[type="password"]')) return;
    if (!form.checkValidity()) return;
    const message = loginMessage(form);
    if (!message) return;
    const scope = form.closest(".auth-card, .a-login-card, main") || document.body;
    const errorBefore = visibleError(scope);
    const btn = form.querySelector('[type="submit"], button:not([type])');
    show({ message, waiting: true });
    handoff(false);
    const started = Date.now();
    let reEnabledAt = 0;
    const poll = setInterval(() => {
      if (!overlay) { clearInterval(poll); return; }
      if (navigating) return; // sign-in worked and the browser is moving on
      if (btn && !btn.disabled && !reEnabledAt && Date.now() - started > 200) reEnabledAt = Date.now();
      const failed = (!errorBefore && visibleError(scope)) ||
        (reEnabledAt && Date.now() - reEnabledAt > 700) ||
        Date.now() - started > 15000;
      if (failed) {
        clearInterval(poll);
        clearHandoff();
        hide(900);
      }
    }, 200);
  }, false);

  /* ---------- On load ---------- */
  const h = takeHandoff();
  if (h && h.played) {
    // came from a login that already showed the full animation
    show({ static: true, message: "Welcome back" });
    setTimeout(() => hide(), 500);
  } else if (h) {
    // the login redirected before the animation could finish: play it here
    show({ message: "Welcome back" }).then(() => hide());
  } else if (me && me.hasAttribute("data-splash")) {
    let seen = false;
    try { seen = sessionStorage.getItem(SEEN_KEY) === "1"; sessionStorage.setItem(SEEN_KEY, "1"); } catch (e) { seen = true; }
    if (!seen && !reduce) {
      show({ message: "Minimal · Modern · Everyday" });
      const t0 = performance.now();
      let lifted = false;
      const lift = () => {
        if (lifted) return;
        lifted = true;
        setTimeout(() => hide(), Math.max(0, 2300 - (performance.now() - t0)));
      };
      if (document.readyState === "complete") lift();
      else window.addEventListener("load", lift, { once: true });
      setTimeout(lift, 3200); // never hold visitors longer than this on slow networks
    }
  }

  window.KrisinLogo = { show, hide, setMessage, handoff };
})();
