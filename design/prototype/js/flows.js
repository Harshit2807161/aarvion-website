/* Aarvion customer flows: the cart (localStorage), drawer and dialogs, OTP
   sign-in, inline validation, checkout, order and account. Vanilla JS, no
   build step. `?state=<name>` loads a debug state into memory only, so a
   capture never overwrites the visitor's own cart. */
(() => {
  "use strict";

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const PAGE = document.body.dataset.page || "";
  const params = new URLSearchParams(location.search);
  const STATE = params.get("state") || "";
  const DEMO = STATE !== "";
  const mqReduce = matchMedia("(prefers-reduced-motion: reduce)");
  const mqPhone = matchMedia("(max-width: 639px)");
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const icon = (n, cls = "i") => `<svg class="${cls}" aria-hidden="true"><use href="#i-${n}"/></svg>`;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  /* ── Catalogue: mirror of data/products.json (MRP in paise). Price is
     always derived as MRP − ₹20 and never stored. ────────────────────── */
  const OFF = 2000;
  const LIMIT_EACH = 10;
  const LIMIT_ORDER = 20;
  const COD_LIMIT = 500000;
  const CATALOGUE = [
    { slug: "bemptor-r40", name: "Bemptor-R40", comp: [["Bempedoic Acid", "180 mg"], ["Rosuvastatin (as calcium)", "40 mg"]], pack: "Strip of 10 tablets", mrp: 63000, w: 600, h: 483 },
    { slug: "bemptor-180", name: "Bemptor-180", comp: [["Bempedoic Acid", "180 mg"]], pack: "Strip of 10 tablets", mrp: 38000, w: 600, h: 512 },
    { slug: "sacuwin-100", name: "Sacuwin 100", comp: [["Sacubitril (as sodium)", "49 mg"], ["Valsartan", "51 mg"]], pack: "Strip of 14 tablets", mrp: 40700, w: 535, h: 600 },
    { slug: "sacuwin-200", name: "Sacuwin 200", comp: [["Sacubitril (as sodium)", "97 mg"], ["Valsartan", "103 mg"]], pack: "Strip of 7 tablets", mrp: 29000, w: 396, h: 600 },
    { slug: "sacuwin-50", name: "Sacuwin 50", comp: [["Sacubitril (as sodium)", "24 mg"], ["Valsartan", "26 mg"]], pack: "Strip of 14 tablets", mrp: 28100, w: 527, h: 600 },
    { slug: "vildage-m-50-500", name: "Vildage-M 50/500", comp: [["Vildagliptin", "50 mg"], ["Metformin Hydrochloride", "500 mg"]], pack: "Strip of 15 tablets", mrp: 18500, w: 346, h: 581 },
    { slug: "hyloage", name: "Hyloage Eye Drops", comp: [["Sodium Hyaluronate", "0.1% w/v"], ["Stabilized Oxychloro Complex (preservative)", "0.005% w/v"]], pack: "10 ml", mrp: 42500, w: 600, h: 495 },
    { slug: "sysnet-ultra", name: "Sysnet Ultra Eye Drops", comp: [["Polyethylene Glycol 400", "0.4% w/v"], ["Propylene Glycol", "0.3% w/v"], ["Stabilized Oxychloro Complex (preservative)", "0.005% w/v"]], pack: "10 ml", mrp: 41600, w: 547, h: 600 },
    { slug: "caftop", name: "Caftop Eye Drops", comp: [["Alcaftadine", "0.25% w/v (2.5 mg/ml)"], ["Benzalkonium Chloride (preservative)", "0.005% w/v"]], pack: "5 ml", mrp: 26300, w: 445, h: 600 },
    { slug: "oloage-kt", name: "Oloage-KT Eye Drops", comp: [["Olopatadine (as hydrochloride)", "0.1% w/v"], ["Ketorolac Tromethamine", "0.4% w/v"]], pack: "5 ml", mrp: 20900, w: 587, h: 600 },
    { slug: "mucohelp", name: "Mucohelp", comp: [["Ambroxol Hydrochloride", "75 mg"]], pack: "Strip of 10 tablets", mrp: 20900, w: 600, h: 496 },
  ];
  const BY = Object.fromEntries(CATALOGUE.map((p) => [p.slug, p]));
  const priceOf = (p) => p.mrp - OFF;
  const NF = new Intl.NumberFormat("en-IN");
  const inr = (paise) => "₹" + NF.format(Math.round(paise / 100));
  const inrH = (paise) => inr(paise).replace(/,/g, '<span class="cm">,</span>');
  const comp = (p) => p.comp.map((c) => c.join(" ")).join(" + ");
  const imgSrc = (slug) => `../assets/products/${slug}.webp`;
  const packs = (n) => `${n} ${n === 1 ? "pack" : "packs"}`;
  const fmtMobile = (d) => `+91 ${d.slice(0, 5)} ${d.slice(5)}`;
  const listText = (a) => (a.length < 2 ? a.join("") : `${a.slice(0, -1).join(", ")} and ${a[a.length - 1]}`);
  function totalsOf(items) {
    let mrp = 0, n = 0;
    for (const i of items) { mrp += BY[i.slug].mrp * i.qty; n += i.qty; }
    return { mrp, off: OFF * n, pay: mrp - OFF * n, n };
  }

  /* ── Example data (labelled "Example" wherever a visitor could mistake it) */
  const EX = {
    user: { name: "Priya Sharma", mobile: "9876543210", email: "" },
    cart: [{ slug: "sacuwin-100", qty: 2 }, { slug: "hyloage", qty: 1 }],
    bigCart: [{ slug: "bemptor-r40", qty: 8 }, { slug: "sacuwin-100", qty: 2 }],
    addresses: [
      { id: "a1", name: "Priya Sharma", mobile: "9876543210", line1: "Flat 302, Sunrise Apartments", line2: "Sector 9, Dwarka", landmark: "", city: "New Delhi", state: "Delhi", pin: "110075", def: true },
      { id: "a2", name: "Rakesh Sharma", mobile: "9123456780", line1: "House 14, Gandhi Nagar", line2: "Civil Lines", landmark: "Opposite the post office", city: "Jaipur", state: "Rajasthan", pin: "302006", def: false },
    ],
    rx: {
      rx1: { patient: "Priya Sharma", file: "prescription-nov.jpg", tag: ["ok", "Approved · valid until 10 May 2027"] },
      rx2: { patient: "Rakesh Sharma", file: "rx-eye-clinic.pdf", tag: ["wait", "Under review"] },
      "AAR-2610-00017": { patient: "Rakesh Sharma", file: "From order AAR-2610-00017", tag: ["ok", "Approved · valid until 20 Apr 2027"] },
    },
  };

  /* ── Storage: localStorage when it works, memory otherwise ─────────── */
  const mem = {};
  const store = {
    get(k, d) {
      if (DEMO) return k in mem ? mem[k] : d;
      try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return k in mem ? mem[k] : d; }
    },
    set(k, v) {
      mem[k] = v;
      if (DEMO) return;
      try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* private mode or full: memory only */ }
    },
    del(k) {
      delete mem[k];
      if (DEMO) return;
      try { localStorage.removeItem(k); } catch (e) { /* ignore */ }
    },
  };
  const K = { cart: "aarvion.cart.v1", session: "aarvion.session.v1", order: "aarvion.lastOrder.v1" };

  if (DEMO) {
    const signedStates = /^(checkout|cod-|order-|account-)/;
    mem[K.cart] = { items: STATE === "cart-empty" ? [] : (STATE === "cod-disabled" ? EX.bigCart : EX.cart).map((i) => ({ ...i })), seeded: false };
    if (signedStates.test(STATE) || PAGE === "checkout" || PAGE === "account" || PAGE === "order") mem[K.session] = { ...EX.user };
  }

  /* ── Cart ─────────────────────────────────────────────────────────── */
  const Cart = {
    items: [],
    seeded: false,
    subs: [],
    load() {
      const v = store.get(K.cart, null);
      if (v === null) {
        this.items = EX.cart.map((i) => ({ ...i }));
        this.seeded = true;
        this.save();
      } else {
        this.items = (v.items || []).filter((i) => BY[i.slug] && i.qty > 0).map((i) => ({ slug: i.slug, qty: Math.min(LIMIT_EACH, i.qty | 0) }));
        this.seeded = !!v.seeded;
      }
    },
    save() { store.set(K.cart, { items: this.items, seeded: this.seeded }); },
    emit(info = {}) { this.save(); this.subs.forEach((f) => f(info)); },
    on(f) { this.subs.push(f); },
    get(slug) { return this.items.find((i) => i.slug === slug); },
    count() { return this.items.reduce((a, i) => a + i.qty, 0); },
    set(slug, qty) {
      const it = this.get(slug);
      const cur = it ? it.qty : 0;
      const room = LIMIT_ORDER - (this.count() - cur);
      const q = Math.max(0, Math.min(LIMIT_EACH, room, qty));
      if (q === cur) return cur;
      if (!it && q > 0) this.items.push({ slug, qty: q });
      else if (q === 0) this.items = this.items.filter((i) => i.slug !== slug);
      else it.qty = q;
      this.seeded = false;
      this.emit({ slug });
      return q;
    },
    add(list) {
      let added = 0;
      list.forEach(({ slug, qty }) => {
        const before = this.get(slug) ? this.get(slug).qty : 0;
        const room = Math.min(LIMIT_EACH - before, LIMIT_ORDER - this.count());
        const n = Math.max(0, Math.min(room, qty));
        if (!n) return;
        if (before) this.get(slug).qty += n; else this.items.push({ slug, qty: n });
        added += n;
      });
      this.seeded = false;
      this.emit({});
      return added;
    },
    remove(slug) {
      const i = this.items.findIndex((x) => x.slug === slug);
      if (i < 0) return null;
      const [it] = this.items.splice(i, 1);
      this.seeded = false;
      this.emit({ removed: slug });
      return { it, i };
    },
    restore(snap) {
      if (!snap || this.get(snap.it.slug)) return;
      this.items.splice(Math.min(snap.i, this.items.length), 0, snap.it);
      this.emit({ restored: snap.it.slug });
    },
    clear() { this.items = []; this.seeded = false; this.emit({ cleared: true }); },
    totals() { return totalsOf(this.items); },
  };
  Cart.load();

  /* ── Session (prototype sign-in) ──────────────────────────────────── */
  const Session = {
    get() { return store.get(K.session, null); },
    in() { return !!this.get(); },
    signIn(u) { store.set(K.session, u); renderAcct(); },
    signOut() { store.del(K.session); renderAcct(); },
  };
  const NEXT_OK = /^(checkout|account|cart|order)\.html(\?[a-z0-9=&-]+)?(#[a-z-]+)?$/;
  const safeNext = (n) => (n && NEXT_OK.test(n) ? n : "");

  /* ── Announcements and toasts ─────────────────────────────────────── */
  function say(msg) {
    const l = $("#live");
    if (!l) return;
    l.textContent = "";
    setTimeout(() => { l.textContent = msg; }, 50);
  }
  function toast(msg, { action, onAction, ic = "check", ms = 4600 } = {}) {
    const host = $("[data-toasts]");
    if (!host) return;
    $$(".toast", host).forEach(leave);
    const t = document.createElement("div");
    t.className = "toast";
    t.innerHTML = `${icon(ic)}<span></span>${action ? `<button class="btn btn-sand" type="button">${esc(action)}</button>` : ""}`;
    $("span", t).textContent = msg;
    host.append(t);
    say(msg);
    let timer = setTimeout(() => leave(t), ms);
    const hold = () => clearTimeout(timer);
    const go = () => { clearTimeout(timer); timer = setTimeout(() => leave(t), 2400); };
    t.addEventListener("pointerenter", hold);
    t.addEventListener("pointerleave", go);
    t.addEventListener("focusin", hold);
    t.addEventListener("focusout", go);
    if (action) $("button", t).addEventListener("click", () => { onAction && onAction(); leave(t); });
  }
  function leave(t) {
    if (t.classList.contains("is-leaving")) return;
    t.classList.add("is-leaving");
    setTimeout(() => t.remove(), 240);
  }
  async function busy(btn, label, ms) {
    const html = btn.innerHTML;
    btn.classList.add("is-busy");
    btn.setAttribute("aria-busy", "true");
    btn.innerHTML = `<span class="spin" aria-hidden="true"></span><span>${esc(label)}</span>`;
    say(label);
    await wait(ms);
    btn.classList.remove("is-busy");
    btn.removeAttribute("aria-busy");
    btn.innerHTML = html;
  }

  /* ── Sheets: drawer, dialog, bottom sheet ─────────────────────────── */
  const Sheets = (() => {
    const stack = [];
    const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
    const visible = (el) => !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
    function open(el, trigger, focusSel) {
      if (!el || stack.some((s) => s.el === el)) return;
      const inerted = Array.from(document.body.children).filter((c) => c !== el && !c.inert && !c.matches("[data-toasts], #live, script, .sprite"));
      inerted.forEach((c) => { c.inert = true; });
      stack.push({ el, trigger: trigger || document.activeElement, inerted });
      document.documentElement.classList.add("has-sheet");
      el.classList.add("is-open");
      const panel = $(".sheet-panel", el);
      panel.style.transform = "";
      requestAnimationFrame(() => {
        const f = (focusSel && $(focusSel, el)) || panel;
        f.focus({ preventScroll: true });
      });
      el.dispatchEvent(new CustomEvent("sheet:open"));
    }
    function close(el, { restore = true } = {}) {
      const i = stack.findIndex((s) => s.el === el);
      if (i < 0) return;
      const [s] = stack.splice(i, 1);
      el.classList.remove("is-open");
      s.inerted.forEach((c) => { c.inert = false; });
      if (!stack.length) document.documentElement.classList.remove("has-sheet");
      if (restore && s.trigger && document.contains(s.trigger) && visible(s.trigger)) s.trigger.focus({ preventScroll: true });
      el.dispatchEvent(new CustomEvent("sheet:close"));
    }
    const top = () => stack[stack.length - 1];
    document.addEventListener("keydown", (e) => {
      const t = top();
      if (!t) return;
      if (e.key === "Escape") { e.preventDefault(); close(t.el); return; }
      if (e.key !== "Tab") return;
      const items = $$(FOCUSABLE, $(".sheet-panel", t.el)).filter(visible);
      if (!items.length) { e.preventDefault(); return; }
      const first = items[0], last = items[items.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === $(".sheet-panel", t.el))) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
    document.addEventListener("click", (e) => {
      const c = e.target.closest("[data-sheet-close]");
      if (c) close(c.closest("[data-sheet]"));
    });
    // Drag the header down to dismiss a bottom sheet (phones only).
    $$("[data-sheet]").forEach((el) => {
      const panel = $(".sheet-panel", el), head = $(".sheet-head", el);
      if (!panel || !head) return;
      let id = null, y0 = 0, t0 = 0, dy = 0;
      head.addEventListener("pointerdown", (e) => {
        if (!mqPhone.matches || id !== null || e.button > 0 || e.target.closest("button, a, input")) return;
        id = e.pointerId; y0 = e.clientY; t0 = performance.now(); dy = 0;
        head.setPointerCapture(id);
        panel.classList.add("is-dragging");
      });
      head.addEventListener("pointermove", (e) => {
        if (e.pointerId !== id) return;
        dy = e.clientY - y0;
        const d = dy < 0 ? -Math.sqrt(-dy) * 2 : dy;
        panel.style.transform = `translateY(${d}px)`;
      });
      const end = (e) => {
        if (e.pointerId !== id) return;
        id = null;
        const v = dy / Math.max(1, performance.now() - t0);
        panel.classList.remove("is-dragging");
        panel.style.transform = "";
        if (dy > panel.offsetHeight * 0.28 || (dy > 24 && v > 0.45)) close(el);
      };
      head.addEventListener("pointerup", end);
      head.addEventListener("pointercancel", end);
    });
    return { open, close, top };
  })();

  /* ── Header: nav fill, menu, cart pill, account pill ──────────────── */
  function initNav() {
    const nav = $(".nav");
    if (!nav) return;
    const band = $(".band, .auth-page");
    let raf = 0;
    const set = () => {
      raf = 0;
      const b = band ? band.getBoundingClientRect().bottom : 0;
      nav.classList.toggle("on-light", b < nav.getBoundingClientRect().bottom + 4);
    };
    addEventListener("scroll", () => { if (!raf) raf = requestAnimationFrame(set); }, { passive: true });
    addEventListener("resize", set);
    set();
    const btn = $(".nav-menu"), menu = $("#menu");
    const toggle = (on) => { nav.classList.toggle("menu-open", on); btn.setAttribute("aria-expanded", on); };
    btn && btn.addEventListener("click", () => toggle(!nav.classList.contains("menu-open")));
    document.addEventListener("click", (e) => { if (nav.classList.contains("menu-open") && !nav.contains(e.target)) toggle(false); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && nav.classList.contains("menu-open")) { toggle(false); btn.focus(); } });
    menu && menu.addEventListener("click", (e) => { if (e.target.closest("a")) toggle(false); });
  }

  let countReady = false;
  function renderCount() {
    const n = Cart.count();
    $$(".cart-count").forEach((c) => {
      if (c.textContent === String(n)) return;
      c.textContent = n;
      if (countReady) { c.classList.remove("bump"); void c.offsetWidth; c.classList.add("bump"); }
    });
    $$("[data-cart-open]").forEach((a) => a.setAttribute("aria-label", `Cart, ${packs(n)}`));
    countReady = true;
  }
  function renderAcct() {
    const u = Session.get();
    $$("[data-acct]").forEach((a) => {
      if (u) {
        a.href = "account.html";
        a.dataset.signedIn = "";
        $(".acct-dot", a).textContent = (u.name || "A").trim().charAt(0).toUpperCase();
        $(".acct-label", a).textContent = "Account";
        a.setAttribute("aria-label", `Your account${u.name ? ", " + u.name : ""}`);
      } else {
        a.href = "login.html";
        delete a.dataset.signedIn;
        $(".acct-label", a).textContent = "Sign in";
        a.setAttribute("aria-label", "Sign in");
      }
    });
  }

  /* ── Cart rendering (page, drawer, checkout summary) ──────────────── */
  function lineEl(slug, variant) {
    const p = BY[slug];
    const li = document.createElement("li");
    li.className = "line";
    li.dataset.slug = slug;
    const ctl = variant === "static"
      ? `<p class="line-ctl line-qty" data-qty-text></p>`
      : `<div class="line-ctl">
<div class="qty" role="group" aria-label="Quantity of ${esc(p.name)}"><button type="button" data-dec aria-label="One fewer ${esc(p.name)}">${icon("minus")}</button><output data-q aria-live="polite"></output><button type="button" data-inc aria-label="One more ${esc(p.name)}">${icon("plus")}</button></div>
<button type="button" class="line-remove" data-remove aria-label="Remove ${esc(p.name)} from cart">${icon("trash")}${variant === "full" ? "<span>Remove</span>" : ""}</button>
<span class="line-max" data-max hidden></span></div>`;
    li.innerHTML = `<span class="well" aria-hidden="true"><img src="${imgSrc(slug)}" alt="" width="${p.w}" height="${p.h}" decoding="async"></span>
<div class="line-main"><h3 class="line-name">${esc(p.name)} <abbr class="rx" title="Prescription required">Rx</abbr></h3><p class="line-salt">${esc(comp(p))}</p><p class="line-pack">${esc(p.pack)}</p></div>
<p class="line-price" data-price></p>${ctl}`;
    return li;
  }
  function priceHTML(p, q) {
    const each = priceOf(p);
    return `<s class="mrp"><span class="sr-only">MRP </span>${inrH(p.mrp * q)}</s> <b class="price mono"><span class="sr-only">, you pay </span>${inrH(each * q)}</b>${q > 1 ? `<span class="each mono">${inrH(each)} each</span>` : ""}`;
  }
  function patchLine(li, it) {
    const p = BY[it.slug], q = it.qty;
    $("[data-price]", li).innerHTML = priceHTML(p, q);
    const out = $("[data-q]", li);
    if (out) {
      out.textContent = q;
      const full = q >= LIMIT_EACH, orderFull = Cart.count() >= LIMIT_ORDER;
      $("[data-dec]", li).setAttribute("aria-disabled", String(q <= 1));
      $("[data-inc]", li).setAttribute("aria-disabled", String(full || orderFull));
      const max = $("[data-max]", li);
      max.hidden = !(full || orderFull);
      max.textContent = full ? `Up to ${LIMIT_EACH} of each per order` : `${LIMIT_ORDER}-pack order limit reached`;
    }
    const qt = $("[data-qty-text]", li);
    if (qt) qt.innerHTML = `Qty <b>${q}</b>`;
  }
  function renderLines(list, items = Cart.items) {
    const variant = list.dataset.cartLines || "static";
    const have = new Map($$(":scope > .line:not(.is-leaving)", list).map((li) => [li.dataset.slug, li]));
    items.forEach((it, idx) => {
      let li = have.get(it.slug);
      if (!li) li = lineEl(it.slug, variant);
      have.delete(it.slug);
      const live = $$(":scope > .line:not(.is-leaving)", list);
      if (live[idx] !== li) list.insertBefore(li, live[idx] || null);
      patchLine(li, it);
    });
    have.forEach((li) => {
      if (mqReduce.matches || !list.offsetParent) { li.remove(); return; }
      li.classList.add("is-leaving");
      setTimeout(() => li.remove(), 190);
    });
  }
  function sumHTML(t, kind) {
    if (kind === "mini") {
      return `<dl class="sum sum--mini"><div class="sum-total"><dt>Total payable</dt><dd><span class="dm" data-stamp>${inrH(t.pay)}</span></dd></div></dl>
<p class="sum-tax">MRP ${inr(t.mrp)} less ${inr(t.off)} Aarvion discount<br>Free delivery · Inclusive of all taxes</p>`;
    }
    return `<dl class="sum">
<div><dt>MRP total</dt><dd>${inrH(t.mrp)}</dd></div>
<div class="sum-off"><dt>Aarvion discount<small>₹20 × ${packs(t.n)}</small></dt><dd><span aria-hidden="true">−</span><span class="sr-only">minus </span>${inrH(t.off)}</dd></div>
<div class="sum-free"><dt>Delivery</dt><dd>Free</dd></div>
<div class="sum-total"><dt>Total payable</dt><dd><span class="dm" data-stamp>${inrH(t.pay)}</span></dd></div>
</dl><p class="sum-tax">Inclusive of all taxes</p>`;
  }
  let lastPay = null;
  function stampTotals() {
    $$("[data-stamp]").forEach((el) => {
      if (!el.offsetParent || !el.animate) return;
      el.getAnimations().forEach((a) => a.cancel());
      el.animate(mqReduce.matches
        ? [{ opacity: 0.45 }, { opacity: 1 }]
        : [{ opacity: 0.35, transform: "scale(1.12)" }, { opacity: 1, transform: "none" }],
      { duration: mqReduce.matches ? 160 : 220, easing: "cubic-bezier(0.23, 1, 0.32, 1)" });
    });
  }
  function renderCart() {
    const n = Cart.count(), empty = n === 0, t = Cart.totals();
    const changed = lastPay !== null && lastPay !== t.pay && !empty;
    lastPay = t.pay;
    $$("[data-cart-filled]").forEach((el) => { el.hidden = empty; });
    $$("[data-cart-empty]").forEach((el) => { el.hidden = !empty; });
    $$("[data-cart-lines]").forEach((l) => renderLines(l));
    $$("[data-summary]").forEach((el) => { el.innerHTML = sumHTML(t, el.dataset.summary); });
    $$("[data-cart-packs]").forEach((el) => { el.textContent = packs(n); });
    $$("[data-cart-kinds]").forEach((el) => { const k = Cart.items.length; el.textContent = `${k} ${k === 1 ? "medicine" : "medicines"}`; });
    $$("[data-total]").forEach((el) => { el.innerHTML = inrH(t.pay); });
    $$("[data-seed-note]").forEach((el) => { el.hidden = !Cart.seeded || empty; });
    $$("[data-order-limit]").forEach((el) => { el.hidden = n < LIMIT_ORDER; });
    $$("[data-cart-keep]").forEach((el) => { el.textContent = n ? `Your cart (${packs(n)}) stays as it is when you sign in.` : "Your cart stays as it is when you sign in."; });
    renderCount();
    if (changed) stampTotals();
    document.dispatchEvent(new CustomEvent("cart:render"));
  }
  Cart.on(renderCart);
  addEventListener("storage", (e) => { if (e.key === K.cart) { Cart.load(); renderCart(); } if (e.key === K.session) renderAcct(); });

  // Steppers and remove, anywhere a cart line lives.
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-inc], [data-dec], [data-remove]");
    const li = b && b.closest(".line[data-slug]");
    if (!li) return;
    const slug = li.dataset.slug, p = BY[slug], it = Cart.get(slug);
    if (!it) return;
    if (b.hasAttribute("data-remove")) { removeWithUndo(slug, li); return; }
    if (b.getAttribute("aria-disabled") === "true") {
      if (b.hasAttribute("data-inc")) say(it.qty >= LIMIT_EACH ? `You can order up to ${LIMIT_EACH} packs of ${p.name}.` : `One order can hold up to ${LIMIT_ORDER} packs.`);
      return;
    }
    const q = Cart.set(slug, it.qty + (b.hasAttribute("data-inc") ? 1 : -1));
    say(`${p.name}: ${packs(q)}`);
  });
  function removeWithUndo(slug, li) {
    const p = BY[slug];
    const inSheet = li.closest(".sheet");
    const snap = Cart.remove(slug);
    const target = inSheet ? $("#cart-drawer-title") : Cart.count() ? $("#g-rx") : $("#cart-title");
    target && target.focus({ preventScroll: true });
    toast(`Removed ${p.name}`, { action: "Undo", ic: "trash", onAction: () => { Cart.restore(snap); say(`${p.name} is back in your cart`); } });
  }
  document.addEventListener("click", (e) => {
    if (!e.target.closest("[data-cart-clear]")) return;
    Cart.clear();
    say("Your cart is empty");
    const t = $("#cart-drawer-title");
    if (t && t.closest(".is-open")) t.focus();
    else { const c = $("#cart-title"); c && c.focus(); }
  });

  // Cart pill opens the drawer (except on the cart page itself).
  document.addEventListener("click", (e) => {
    const a = e.target.closest("[data-cart-open], [data-edit-cart]");
    if (!a) return;
    if (PAGE === "cart" && a.hasAttribute("data-cart-open")) { e.preventDefault(); const t = $("#cart-title"); t.scrollIntoView({ block: "start" }); t.focus({ preventScroll: true }); return; }
    const d = $("#cart-drawer");
    if (!d) return;
    e.preventDefault();
    Sheets.open(d, a, "#cart-drawer-title");
  });

  // Checkout needs a signed-in customer.
  document.addEventListener("click", (e) => {
    const a = e.target.closest("[data-checkout]");
    if (!a) return;
    if (!Cart.count()) { e.preventDefault(); return; }
    if (Session.in()) return;
    e.preventDefault();
    const dlg = $("#login-dialog");
    const drawer = $("#cart-drawer");
    const trigger = a.closest(".sheet") ? $("[data-cart-open]") : a;
    if (drawer && drawer.classList.contains("is-open")) Sheets.close(drawer, { restore: false });
    if (dlg) openLogin(trigger, "checkout.html");
    else location.href = "login.html?next=checkout.html";
  });

  // Account pill: dialog when signed out, the page form on the login page.
  document.addEventListener("click", (e) => {
    const a = e.target.closest("[data-acct]");
    if (!a || Session.in()) return;
    if (PAGE === "login") { e.preventDefault(); const f = $("#pg-mobile:not(:disabled), #pg-email:not(:disabled)"); f && f.focus(); return; }
    if ($("#login-dialog")) { e.preventDefault(); openLogin(a, ""); }
  });

  // The cart page's mobile dock appears once the summary button scrolls away.
  function initDock() {
    const dock = $("[data-dock]"), anchor = $("[data-dock-anchor]");
    if (!dock || !anchor || !("IntersectionObserver" in window)) return;
    let seen = true;
    const set = () => {
      const show = !seen && Cart.count() > 0;
      dock.classList.toggle("is-shown", show);
      dock.inert = !show;
      document.body.classList.toggle("dock-on", show);
    };
    new IntersectionObserver(([en]) => { seen = en.isIntersecting; set(); }).observe(anchor);
    Cart.on(set);
  }

  /* ── Validation: on blur once touched, live once wrong ────────────── */
  const RULES = {
    name: (v) => (v.length >= 2 && /[a-zऀ-ॿ]/i.test(v) ? "" : "Enter the full name, at least 2 letters."),
    mobile: (v) => (/^[6-9]\d{9}$/.test(v) ? "" : "Enter a 10-digit mobile number that starts with 6, 7, 8 or 9."),
    email: (v) => (/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) ? "" : "Enter an email address like name@example.com."),
    pincode: (v) => (/^[1-9]\d{5}$/.test(v) ? "" : (/^\d{6}$/.test(v) ? "Pincodes don’t start with 0. Check the number." : "Enter a 6-digit pincode, like 110092.")),
  };
  function labelOf(el) { const l = el.id && $(`label[for="${el.id}"]`); return l ? l.textContent.replace(/\(optional\)/, "").trim().toLowerCase() : "this"; }
  function check(el) {
    if (el.disabled || el.closest("[hidden]")) return "";
    if (el.type === "checkbox") return el.required && !el.checked ? el.dataset.msgRequired || "Tick this box to continue." : "";
    if (el.type === "radio") {
      const group = $$(`input[type="radio"][name="${el.name}"]`, el.form || document);
      return group.some((r) => r.required) && !group.some((r) => r.checked) ? group.find((r) => r.required).dataset.msgRequired || "Choose one." : "";
    }
    const v = String(el.value).trim();
    if (!v) return el.required ? el.dataset.msgRequired || (el.tagName === "SELECT" ? `Choose ${labelOf(el)}.` : `Enter ${labelOf(el)}.`) : "";
    const r = RULES[el.dataset.rule];
    return r ? r(v) : "";
  }
  function holderOf(el) { return el.type === "radio" ? el.closest("fieldset") : el.closest(".check") || el.closest(".field"); }
  function showErr(el, msg) {
    const f = holderOf(el);
    if (!f) return;
    const isCheck = f.classList.contains("check");
    let p = isCheck ? (f.nextElementSibling && f.nextElementSibling.classList.contains("field-err") ? f.nextElementSibling : null) : $(":scope > .field-err:not([data-upload-err])", f);
    if (!p && msg) {
      p = document.createElement("p");
      p.className = "field-err";
      p.id = (el.id || el.name) + "-err";
      p.innerHTML = icon("alert") + "<span></span>";
      if (isCheck) f.after(p); else f.append(p);
    }
    const ids = new Set((el.getAttribute("aria-describedby") || "").split(/\s+/).filter(Boolean));
    if (msg) {
      $("span", p).textContent = msg;
      p.hidden = false;
      ids.add(p.id);
      el.setAttribute("aria-invalid", "true");
      f.classList.add("is-invalid");
    } else {
      if (p) { p.hidden = true; ids.delete(p.id); }
      el.removeAttribute("aria-invalid");
      f.classList.remove("is-invalid");
    }
    if (ids.size) el.setAttribute("aria-describedby", [...ids].join(" ")); else el.removeAttribute("aria-describedby");
  }
  function normMobile(v) {
    let d = String(v).replace(/\D/g, "");
    if (d.length > 10 && d.startsWith("91")) d = d.slice(2);
    if (d.length > 10 && d.startsWith("0")) d = d.slice(1);
    if (d.length === 11 && d.startsWith("0")) d = d.slice(1);
    return d.slice(0, 10);
  }
  document.addEventListener("input", (e) => {
    const el = e.target;
    if (!el.matches || !el.matches("input, select, textarea")) return;
    if (el.dataset.rule === "mobile") { const d = normMobile(el.value); if (d !== el.value) el.value = d; }
    if (el.dataset.rule === "pincode") { const d = el.value.replace(/\D/g, "").slice(0, 6); if (d !== el.value) el.value = d; }
    if (el.getAttribute("aria-invalid") === "true") showErr(el, check(el));
  });
  document.addEventListener("change", (e) => {
    const el = e.target;
    if (el.type === "checkbox" && el.getAttribute("aria-invalid") === "true") showErr(el, check(el));
    if (el.type === "radio") { const g = $$(`input[name="${el.name}"]`); const bad = g.find((r) => r.getAttribute("aria-invalid") === "true"); if (bad) showErr(bad, ""); }
    if (el.tagName === "SELECT" && el.closest("[data-v]")) { el.dataset.touched = "1"; showErr(el, check(el)); }
  });
  document.addEventListener("focusout", (e) => {
    const el = e.target;
    if (!el.matches || !el.matches("[data-v] input:not([type=checkbox]):not([type=radio]), [data-v] textarea")) return;
    if (!el.value.trim() && !el.dataset.touched) return;
    el.dataset.touched = "1";
    showErr(el, check(el));
  });
  function validate(scope, summary) {
    const els = $$("input, select, textarea", scope).filter((el) => !el.disabled && !el.closest("[hidden]") && (el.required || el.dataset.rule));
    const seen = new Set();
    const errs = [];
    els.forEach((el) => {
      if (el.type === "radio") { if (seen.has(el.name)) return; seen.add(el.name); el = $$(`input[name="${el.name}"]`, scope).find((r) => r.required) || el; }
      const msg = check(el);
      el.dataset.touched = "1";
      showErr(el, msg);
      if (msg) errs.push({ el, msg });
    });
    if (summary) errSummary(summary, errs);
    else if (errs.length) errs[0].el.focus();
    return errs;
  }
  function errSummary(box, errs) {
    if (!errs.length) { box.hidden = true; box.innerHTML = ""; return; }
    box.innerHTML = `<p class="errsum-title">${icon("alert")}${errs.length === 1 ? "There’s a problem" : `There are ${errs.length} problems`}</p><ul>${errs.map((e) => `<li><a href="#${e.el.id}">${esc(e.msg)}</a></li>`).join("")}</ul>`;
    box.hidden = false;
    box.focus();
  }
  document.addEventListener("click", (e) => {
    const a = e.target.closest(".errsum a");
    if (!a) return;
    e.preventDefault();
    const el = document.getElementById(a.getAttribute("href").slice(1));
    if (!el) return;
    el.scrollIntoView({ block: "center", behavior: mqReduce.matches ? "auto" : "smooth" });
    el.focus({ preventScroll: true });
  });

  /* ── OTP: one real input (paste, autofill) drawn as six boxes ─────── */
  function OTP(wrap, { onComplete }) {
    const input = $(".otp-input", wrap), boxes = $$(".otp-box", wrap);
    const draw = () => {
      const v = input.value;
      boxes.forEach((b, i) => {
        b.textContent = v[i] || "";
        b.classList.toggle("is-filled", !!v[i]);
        b.classList.toggle("is-active", i === Math.min(v.length, 5));
      });
    };
    const toEnd = () => { const n = input.value.length; try { input.setSelectionRange(n, n); } catch (e) { /* ignore */ } };
    input.addEventListener("input", () => {
      const d = input.value.replace(/\D/g, "").slice(0, 6);
      if (d !== input.value) input.value = d;
      wrap.classList.remove("is-invalid");
      draw();
      if (d.length === 6) onComplete(d);
    });
    input.addEventListener("paste", (e) => {
      const t = (e.clipboardData || window.clipboardData).getData("text");
      const d = t.replace(/\D/g, "").slice(0, 6);
      if (!d) return;
      e.preventDefault();
      input.value = d;
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    input.addEventListener("focus", () => { wrap.classList.add("is-focused"); draw(); });
    input.addEventListener("blur", () => wrap.classList.remove("is-focused"));
    input.addEventListener("pointerup", () => { if (!wrap.classList.contains("is-invalid")) requestAnimationFrame(toEnd); });
    draw();
    return {
      el: input,
      set(v) { input.value = v; draw(); },
      clear() { input.value = ""; draw(); },
      invalid(on) {
        wrap.classList.toggle("is-invalid", on);
        if (on && !mqReduce.matches) { wrap.classList.remove("shake"); void wrap.offsetWidth; wrap.classList.add("shake"); }
      },
      lock(on) { input.disabled = on; wrap.classList.toggle("is-locked", on); },
    };
  }

  /* ── Sign-in: identify → code → (new account) → done ──────────────── */
  function Auth(root, { onDone } = {}) {
    const P = root.dataset.prefix;
    const step = (n) => $(`[data-step="${n}"]`, root);
    const MAX_TRIES = 5, WAIT = 30;
    let via = "mobile", value = "", sentTo = "", tries = 0, locked = false, known = false, left = 0, timer = 0;
    const alertBox = $("[data-otp-alert]", root);
    const verifyBtn = $("[data-verify]", root);
    const resendMain = $("[data-resend-main]", root);
    const meta = $(".otp-meta", root);
    const lockMsg = (s) => (s > 0
      ? `Too many wrong codes, so this code no longer works. You can ask for a new one in <span class="mono">0:${String(s).padStart(2, "0")}</span>.`
      : "Too many wrong codes, so this code no longer works. Ask for a new one below.");
    const otp = OTP($("[data-otp]", root), { onComplete: () => verify() });

    function show(name, focusSel, animate = true) {
      $$("[data-step]", root).forEach((s) => {
        const on = s.dataset.step === name;
        s.hidden = !on;
        s.classList.remove("enter");
        if (on && animate) { void s.offsetWidth; s.classList.add("enter"); }
      });
      root.dataset.at = name;
      if (focusSel !== false) {
        const f = focusSel ? $(focusSel, step(name)) : $("[tabindex='-1']", step(name));
        f && f.focus({ preventScroll: true });
      }
    }
    function setVia(v, focus) {
      via = v;
      $$("[data-via]", root).forEach((f) => {
        const on = f.dataset.via === via;
        f.hidden = !on;
        const inp = $("input", f);
        inp.disabled = !on;
        if (!on) showErr(inp, "");
      });
      const r = $(`input[name="${P}-via"][value="${v}"]`, root);
      if (r) r.checked = true;
      if (focus) $(`[data-via="${via}"] input`, root).focus();
    }
    $$(`input[name="${P}-via"]`, root).forEach((r) => r.addEventListener("change", () => setVia(r.value, true)));

    $("[data-id-form]", root).addEventListener("submit", async (e) => {
      e.preventDefault();
      const el = $(`[data-via="${via}"] input`, root);
      const msg = check(el);
      el.dataset.touched = "1";
      showErr(el, msg);
      if (msg) { el.focus(); return; }
      value = via === "mobile" ? normMobile(el.value) : el.value.trim().toLowerCase();
      sentTo = via === "mobile" ? fmtMobile(value) : value;
      known = value === EX.user.mobile || value === "priya.sharma@example.com";
      await busy($("[data-send]", root), "Sending code…", 650);
      toCode();
    });
    function toCode(animate = true) {
      tries = 0; locked = false;
      otp.lock(false); otp.clear(); otp.invalid(false);
      setAlert("");
      verifyBtn.hidden = false;
      resendMain.hidden = true;
      meta.hidden = false;
      $$("[data-sent-to]", root).forEach((b) => { b.textContent = sentTo; });
      show("code", ".otp-input", animate);
      startTimer(WAIT);
      say(`We sent a 6-digit code to ${sentTo}.`);
    }
    function startTimer(sec) {
      clearInterval(timer);
      left = sec;
      const t = $("[data-timer]", root), r = $("[data-resend]", root), n = $("[data-left]", root);
      const tick = () => {
        n.textContent = `0:${String(left).padStart(2, "0")}`;
        const ready = left <= 0;
        t.hidden = ready; r.hidden = !ready;
        if (locked) { $("span", alertBox).innerHTML = lockMsg(left); resendMain.hidden = !ready; }
        if (ready) { clearInterval(timer); say("You can ask for a new code now."); }
        left--;
      };
      tick();
      timer = setInterval(tick, 1000);
    }
    function setAlert(msg) {
      $("span", alertBox).textContent = msg;
      alertBox.hidden = !msg;
      const ids = new Set((otp.el.getAttribute("aria-describedby") || "").split(/\s+/).filter(Boolean));
      if (msg) { ids.add(alertBox.id); otp.el.setAttribute("aria-invalid", "true"); say(msg); }
      else { ids.delete(alertBox.id); otp.el.removeAttribute("aria-invalid"); }
      otp.el.setAttribute("aria-describedby", [...ids].join(" "));
    }
    async function verify() {
      if (locked || root.dataset.verifying) return;
      const v = otp.el.value;
      if (v.length < 6) { setAlert("Enter all 6 digits of the code."); otp.invalid(true); otp.el.focus(); return; }
      root.dataset.verifying = "1";
      await busy(verifyBtn, "Checking…", 550);
      delete root.dataset.verifying;
      if (v === "123456") {
        setAlert("");
        clearInterval(timer);
        if (known) finish(EX.user.name); else show("profile", "input");
        return;
      }
      wrong(v);
    }
    function wrong() {
      tries++;
      if (tries >= MAX_TRIES) { lock(); return; }
      const n = MAX_TRIES - tries;
      setAlert(`That code doesn’t match. ${n} ${n === 1 ? "try" : "tries"} left.`);
      otp.invalid(true);
      otp.el.focus();
      otp.el.select();
    }
    function lock() {
      locked = true;
      otp.invalid(false);
      otp.lock(true);
      verifyBtn.hidden = true;
      meta.hidden = true;
      const shown = Math.max(0, left + 1);
      setAlert(lockMsg(shown).replace(/<[^>]+>/g, ""));
      $("span", alertBox).innerHTML = lockMsg(shown);
      resendMain.hidden = shown > 0;
      if (!resendMain.hidden) resendMain.focus();
    }
    $("[data-code-form]", root).addEventListener("submit", (e) => { e.preventDefault(); verify(); });
    resendMain.addEventListener("click", () => $("[data-resend]", root).click());
    $("[data-resend]", root).addEventListener("click", () => {
      if (left > 0) return;
      toCode(false);
      otp.el.focus();
      toast(`New code sent to ${sentTo}`, { ic: "mail" });
    });
    $("[data-change]", root).addEventListener("click", () => { clearInterval(timer); show("id", `[data-via="${via}"] input`); });
    $("[data-profile-form]", root).addEventListener("submit", (e) => {
      e.preventDefault();
      if (validate(e.currentTarget).length) return;
      finish($(`#${P}-name`).value.trim());
    });
    function finish(name) {
      Session.signIn({ name, mobile: via === "mobile" ? value : "", email: via === "email" ? value : "" });
      show("done");
      onDone && onDone(name);
    }
    return {
      reset() { clearInterval(timer); setVia("mobile", false); show("id", false, false); },
      demo(state) {
        via = "mobile"; value = EX.user.mobile; sentTo = fmtMobile(value); known = false;
        if (state === "new-account") { $$("[data-sent-to]", root).forEach((b) => { b.textContent = sentTo; }); show("profile", false, false); return; }
        toCode(false);
        if (state === "otp-error") { otp.set("482913"); tries = 0; wrong(); }
        if (state === "otp-locked") { otp.set("482913"); tries = MAX_TRIES - 1; wrong(); startTimer(18); }
      },
      show,
    };
  }

  let dialogAuth = null, dialogNext = "";
  function openLogin(trigger, next) {
    const dlg = $("#login-dialog");
    if (!dlg) return;
    dialogNext = next || "";
    dialogAuth.reset();
    Sheets.open(dlg, trigger, "#dlg-mobile");
  }
  function initAuth() {
    const dlgRoot = $("#login-dialog [data-auth]");
    if (dlgRoot) {
      dialogAuth = Auth(dlgRoot, {
        onDone: (name) => {
          const first = (name || "").split(" ")[0];
          $("[data-done-text]", dlgRoot).textContent = dialogNext ? "Taking you to checkout…" : `Welcome${first ? ", " + first : ""}.`;
          setTimeout(() => {
            if (dialogNext) { location.href = dialogNext; return; }
            Sheets.close($("#login-dialog"));
            toast(`Signed in${first ? " as " + first : ""}`);
          }, 900);
        },
      });
    }
    const pageRoot = PAGE === "login" && $("#signin [data-auth]");
    if (pageRoot) {
      const next = safeNext(params.get("next"));
      const a = Auth(pageRoot, {
        onDone: () => {
          $("[data-done-text]", pageRoot).textContent = next.startsWith("checkout") ? "Taking you to checkout…" : "Taking you to your account…";
          if (!DEMO) setTimeout(() => { location.href = next || "account.html"; }, 900);
        },
      });
      if (["otp-sent", "otp-error", "otp-locked", "new-account"].includes(STATE)) a.demo(STATE);
    }
  }

  /* ── Prescription upload (drag-drop, file picker, camera) ─────────── */
  const OK_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
  const OK_EXT = /\.(jpe?g|png|webp|pdf)$/i;
  const MAX_BYTES = 8 * 1024 * 1024;
  const mb = (b) => (b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);
  function Upload(root) {
    const drop = $("[data-drop]", root), card = $("[data-file-card]", root), err = $("[data-upload-err]", root);
    const fileIn = $("[data-file]", root), cam = $("[data-cam]", root);
    let file = null, url = "";
    $("[data-pick]", root).addEventListener("click", () => fileIn.click());
    const camBtn = $("[data-camera]", root);
    camBtn && camBtn.addEventListener("click", () => cam.click());
    [fileIn, cam].forEach((i) => i.addEventListener("change", () => { take(i.files && i.files[0]); i.value = ""; }));
    let depth = 0;
    drop.addEventListener("dragenter", (e) => { e.preventDefault(); depth++; drop.classList.add("is-over"); });
    drop.addEventListener("dragover", (e) => { e.preventDefault(); });
    drop.addEventListener("dragleave", () => { depth = Math.max(0, depth - 1); if (!depth) drop.classList.remove("is-over"); });
    drop.addEventListener("drop", (e) => { e.preventDefault(); depth = 0; drop.classList.remove("is-over"); take(e.dataTransfer.files && e.dataTransfer.files[0]); });
    function fail(msg) {
      $("span", err).textContent = msg;
      err.hidden = !msg;
      drop.classList.toggle("is-invalid", !!msg);
      if (msg) say(msg);
    }
    function take(f) {
      if (!f) return;
      if (!(OK_TYPES.includes(f.type) || OK_EXT.test(f.name))) return fail(`“${f.name}” can’t be used. Choose a JPG, PNG, WebP or PDF file.`);
      if (f.size > MAX_BYTES) return fail(`“${f.name}” is ${mb(f.size)}. Files can be up to 8 MB; try a smaller photo or a PDF.`);
      set(f);
    }
    function set(f, demo) {
      file = f;
      if (url) URL.revokeObjectURL(url);
      url = !demo && /^image\//.test(f.type) ? URL.createObjectURL(f) : "";
      card.innerHTML = `<span class="file-thumb">${url ? `<img src="${url}" alt="">` : icon("file")}</span>
<span class="file-info"><span class="file-name"></span><span class="file-meta">${icon("check")}<span>${mb(f.size)} · ready to send</span></span></span>
<button class="icon-btn" type="button" data-file-remove aria-label="Remove ${esc(f.name)}">${icon("trash")}</button>`;
      $(".file-name", card).textContent = f.name;
      card.hidden = false;
      drop.hidden = true;
      fail("");
      say(`${f.name} added.`);
      $("[data-file-remove]", card).addEventListener("click", () => {
        file = null;
        card.hidden = true;
        drop.hidden = false;
        $("[data-pick]", root).focus();
        say("File removed.");
      });
    }
    return {
      get file() { return file; },
      need() { if (!file) { fail("Add a photo or PDF of the prescription."); return false; } return true; },
      demo() { set({ name: "prescription-priya.jpg", size: 1887436, type: "image/jpeg" }, true); },
      fail,
    };
  }

  /* ── Addresses ────────────────────────────────────────────────────── */
  let ADDR = EX.addresses.map((a) => ({ ...a }));
  const addrHTML = (a) => `${esc(a.line1)}, ${esc(a.line2)}${a.landmark ? `, ${esc(a.landmark)}` : ""}<br>${esc(a.city)}, ${esc(a.state)} <span class="mono">${esc(a.pin)}</span><br><span class="mono">${fmtMobile(a.mobile)}</span>`;
  const addrLine = (a) => `<b>${esc(a.name)}</b>, ${esc(a.line1)}, ${esc(a.line2)}, ${esc(a.city)} <span class="mono">${esc(a.pin)}</span>`;
  function readAddr(form) {
    const v = (n) => form.elements[n].value.trim();
    return { id: "a" + Date.now().toString(36), name: v("name"), mobile: normMobile(v("mobile")), line1: v("line1"), line2: v("line2"), landmark: v("landmark"), city: v("city"), state: v("state"), pin: v("pin"), def: form.elements.def.checked };
  }
  function fillAddr(form, a) {
    ["name", "mobile", "line1", "line2", "landmark", "city", "state", "pin"].forEach((k) => { form.elements[k].value = a ? a[k] : ""; });
    form.elements.def.checked = !!(a && a.def);
    $$("input, select", form).forEach((el) => { delete el.dataset.touched; showErr(el, ""); });
    errSummary($("[data-errsum]", form), []);
  }
  function setDefault(id) { ADDR.forEach((a) => { a.def = a.id === id; }); ADDR.sort((x, y) => (y.def ? 1 : 0) - (x.def ? 1 : 0)); }

  /* ── Checkout ─────────────────────────────────────────────────────── */
  function initCheckout() {
    if (!Session.in()) { location.replace("login.html?next=checkout.html"); return; }
    if (!Cart.count()) { location.replace("cart.html"); return; }
    const steps = $$("[data-cstep]");
    const done = new Set();
    const sel = { addr: null, rx: null, pay: "online" };
    let at = 1;
    const list = $("[data-addr-list]"), form = $("#co-form"), addBtn = $("[data-addr-add]");
    const stepActions = $("[data-cstep='1'] [data-step-actions]");
    const upl = Upload($("[data-mode-panel='upload'] [data-upload]"));

    function renderAddrOpts(checkId) {
      const cur = checkId || ($("input[name=addr]:checked", list) || {}).value || (ADDR.find((a) => a.def) || ADDR[0]).id;
      list.innerHTML = `<legend class="sr-only">Saved addresses</legend>` + ADDR.map((a) => `<label class="opt"><input class="opt-input" type="radio" name="addr" value="${a.id}"${a.id === cur ? " checked" : ""}><span class="opt-radio" aria-hidden="true"></span><span class="opt-body"><span class="opt-title">${esc(a.name)}${a.def ? ' <span class="tag tag--ok">Default</span>' : ""}</span><span class="opt-text">${addrHTML(a)}</span></span></label>`).join("");
    }
    function openForm(on) {
      form.hidden = !on;
      addBtn.hidden = on;
      addBtn.setAttribute("aria-expanded", on);
      stepActions.hidden = on;
      if (on) { fillAddr(form, null); $("#co-name").focus(); } else addBtn.focus();
    }
    addBtn.addEventListener("click", () => openForm(true));
    $("[data-addr-cancel]", form).addEventListener("click", () => openForm(false));
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      if (validate(form, $("[data-errsum]", form)).length) return;
      const a = readAddr(form);
      ADDR.push(a);
      if (a.def) setDefault(a.id);
      renderAddrOpts(a.id);
      form.hidden = true; addBtn.hidden = false; stepActions.hidden = false;
      say("Address saved.");
      complete(1);
    });

    const setRxCopy = () => {
      const names = Cart.items.map((i) => BY[i.slug].name);
      $("[data-rx-count]").textContent = `${names.length} prescription ${names.length === 1 ? "medicine" : "medicines"}`;
      $("[data-rx-names]").textContent = listText(names);
    };
    setRxCopy();

    const modeRadios = $$("input[name=rxmode]");
    const mode = () => ($("input[name=rxmode]:checked") || {}).value || "saved";
    const setMode = (m) => {
      $$("[data-mode-panel]").forEach((p) => { p.hidden = p.dataset.modePanel !== m; });
      const r = $(`input[name=rxmode][value=${m}]`);
      if (r) r.checked = true;
    };
    modeRadios.forEach((r) => r.addEventListener("change", () => setMode(r.value)));

    function payRules() {
      const t = Cart.totals();
      const cod = $("input[name=pay][value=cod]");
      const over = t.pay > COD_LIMIT;
      cod.disabled = over;
      $("[data-cod-why]").hidden = !over;
      if (over && cod.checked) $("input[name=pay][value=online]").checked = true;
      const pay = $("input[name=pay]:checked").value;
      $("[data-place]").textContent = pay === "online" ? `Pay ${inr(t.pay)} and place order` : "Place order, pay on delivery";
      if (done.has(3) && pay !== sel.pay) { sel.pay = pay; summarise(3); }
    }
    let placing = false;
    document.addEventListener("cart:render", () => {
      if (placing) return;
      if (!Cart.count()) { location.href = "cart.html"; return; }
      setRxCopy();
      payRules();
    });
    $$("input[name=pay]").forEach((r) => r.addEventListener("change", payRules));

    function summarise(n) {
      const s = $(`[data-cstep="${n}"] [data-summary-text]`);
      if (!s) return;
      if (n === 1) s.innerHTML = addrLine(sel.addr);
      if (n === 2) s.innerHTML = rxText(sel.rx);
      if (n === 3) s.innerHTML = payText(sel.pay);
    }
    const rxText = (r) => `<b>${esc(r.file)}</b> · patient ${esc(r.patient)}<br><span class="tag tag--${r.tag[0]}">${esc(r.tag[1])}</span>`;
    const payText = (p) => (p === "online" ? "<b>Pay online</b>: UPI, card or netbanking through Razorpay" : "<b>Cash on delivery</b>");

    function collect(n) {
      if (n === 1) {
        const r = $("input[name=addr]:checked", list);
        sel.addr = ADDR.find((a) => a.id === (r && r.value));
        return !!sel.addr;
      }
      if (n === 2) {
        const m = mode();
        if (m === "saved") { const r = $("input[name=rx]:checked"); sel.rx = r && EX.rx[r.value]; return !!sel.rx; }
        if (m === "past") { const r = $("input[name=rxpast]:checked"); sel.rx = r && EX.rx[r.value]; return !!sel.rx; }
        const panel = $("[data-mode-panel='upload']");
        const hasFile = upl.need();
        const errs = validate(panel, null);
        const box = $("[data-errsum]", panel);
        const all = hasFile ? errs : [{ el: $("#co-pick"), msg: "Add a photo or PDF of the prescription." }, ...errs];
        errSummary(box, all);
        if (all.length) return false;
        sel.rx = { patient: $("#co-patient").value.trim(), file: upl.file.name, tag: ["wait", "New · a pharmacist will review it"] };
        return true;
      }
      if (n === 3) { sel.pay = $("input[name=pay]:checked").value; return true; }
      return true;
    }
    function complete(n) {
      if (!collect(n)) return;
      done.add(n);
      summarise(n);
      const next = [2, 3, 4].find((k) => k > n && (!done.has(k) || k === 4));
      go(next);
    }
    function go(n, focus = true) {
      at = n;
      $(".co-steps").classList.toggle("at-review", n === 4);
      steps.forEach((s) => {
        const k = +s.dataset.cstep;
        s.hidden = n === 4 && k < 4;
        const isDone = done.has(k) && k !== n;
        s.classList.toggle("is-current", k === n);
        s.classList.toggle("is-done", isDone);
        s.classList.toggle("is-todo", !isDone && k !== n);
        const body = $("[data-body]", s);
        body.hidden = k !== n;
        if (k === n) { body.classList.remove("enter"); void body.offsetWidth; body.classList.add("enter"); }
        const sum = $("[data-summary-text]", s);
        if (sum) sum.hidden = !isDone || n === 4;
        const ed = $("[data-edit]", s);
        if (ed) ed.hidden = !isDone || n === 4;
        $(".cstep-num", s).innerHTML = isDone ? icon("check") : k;
      });
      $$("[data-prog]").forEach((li) => {
        const k = +li.dataset.prog, b = $("button", li);
        li.classList.toggle("is-current", k === n);
        li.classList.toggle("is-done", done.has(k) && k !== n);
        b.disabled = !(done.has(k) || k === n || done.has(k - 1));
        if (k === n) b.setAttribute("aria-current", "step"); else b.removeAttribute("aria-current");
        $(".prog-dot", li).innerHTML = done.has(k) && k !== n ? `${icon("check")}<span class="sr-only">done</span>` : k;
      });
      if (n === 4) review();
      if (focus) {
        const sec = $(`[data-cstep="${n}"]`);
        sec.scrollIntoView({ behavior: mqReduce.matches ? "auto" : "smooth", block: "start" });
        $("h2", sec).focus({ preventScroll: true });
      }
    }
    function review() {
      $("[data-rv=addr]").innerHTML = addrLine(sel.addr);
      $("[data-rv=rx]").innerHTML = rxText(sel.rx);
      $("[data-rv=pay]").innerHTML = payText(sel.pay);
      payRules();
    }
    $$("[data-next]").forEach((b) => b.addEventListener("click", () => complete(+b.dataset.next)));
    document.addEventListener("click", (e) => {
      const b = e.target.closest("[data-goto]");
      if (!b || b.disabled) return;
      const n = +b.dataset.goto;
      if (n !== at) go(n);
    });
    $("[data-place]").addEventListener("click", async (e) => {
      const b = e.currentTarget;
      const items = Cart.items.map((i) => ({ ...i }));
      const pay = sel.pay;
      await busy(b, pay === "online" ? "Opening Razorpay…" : "Placing your order…", 1300);
      store.set(K.order, { no: "AAR-2611-00042", date: "16 Nov 2026", items, pay, addr: sel.addr, rx: sel.rx, status: "review" });
      placing = true;
      if (!DEMO) Cart.clear();
      location.href = "order.html?placed=1";
    });

    const det = $(".co-sum"), mqNarrow = matchMedia("(max-width: 960px)");
    const sumMode = () => { det.open = !mqNarrow.matches; };
    sumMode();
    mqNarrow.addEventListener("change", sumMode);
    renderAddrOpts();
    setMode("saved");
    payRules();
    // Debug states
    const pre = { "checkout-errors": 1, "checkout-step-2": 2, "checkout-upload": 2, "checkout-step-3": 3, "cod-disabled": 3, "checkout-review": 4 }[STATE] || 1;
    for (let k = 1; k < pre; k++) { collect(k); done.add(k); summarise(k); }
    if (STATE === "checkout-upload") { setMode("upload"); }
    go(pre, false);
    if (STATE === "checkout-errors") { openForm(true); validate(form, $("[data-errsum]", form)); requestAnimationFrame(() => scrollTo(0, 0)); }
  }

  /* ── Order ────────────────────────────────────────────────────────── */
  const ORDERS = {
    "AAR-2611-00042": {
      no: "AAR-2611-00042", date: "16 Nov 2026", items: EX.cart, pay: "online", addr: EX.addresses[0], rx: { patient: "Priya Sharma", file: "prescription-nov.jpg", tag: ["ok", "Approved · valid until 10 May 2027"] },
      t: { placed: "16 Nov 2026, 10:42 am", approved: "16 Nov, 12:15 pm", confirmed: "16 Nov, 12:16 pm", packed: "17 Nov, 11:30 am", shipped: "17 Nov, 4:05 pm", delivered: "19 Nov, 1:20 pm", cancelled: "16 Nov, 11:05 am" },
    },
    "AAR-2610-00017": {
      no: "AAR-2610-00017", date: "22 Oct 2026", items: [{ slug: "bemptor-180", qty: 2 }, { slug: "vildage-m-50-500", qty: 3 }], pay: "cod", addr: EX.addresses[1], rx: { patient: "Rakesh Sharma", file: "rx-oct.jpg", tag: ["ok", "Approved · valid until 20 Apr 2027"] },
      t: { placed: "22 Oct 2026, 9:10 am", approved: "22 Oct, 11:02 am", confirmed: "22 Oct, 11:03 am", packed: "23 Oct, 10:15 am", shipped: "23 Oct, 5:40 pm", delivered: "26 Oct, 12:30 pm" },
    },
    "AAR-2609-00008": {
      no: "AAR-2609-00008", date: "9 Sep 2026", items: [{ slug: "caftop", qty: 1 }], pay: "online", addr: EX.addresses[0], rx: { patient: "Priya Sharma", file: "IMG_1877.jpg", tag: ["off", "Not reviewed: order cancelled"] },
      t: { placed: "9 Sep 2026, 7:55 pm", cancelled: "10 Sep, 9:12 am", refunded: "16 Sep 2026" },
    },
  };
  const HOLD_WHY = "The prescription is dated 2 Mar 2026, more than 6 months ago.";
  const RX_OLD = { patient: "Priya Sharma", file: "prescription-old.jpg", tag: ["bad", "Rejected"], why: HOLD_WHY };
  function initOrder() {
    if (!Session.in()) { location.replace("login.html?next=" + encodeURIComponent("order.html" + location.search)); return; }
    let o, status, example = true, placed = params.get("placed") === "1";
    const map = { "order-placed": ["AAR-2611-00042", "review"], "order-shipped": ["AAR-2611-00042", "shipped"], "order-delivered": ["AAR-2610-00017", "delivered"], "order-on-hold": ["AAR-2611-00042", "hold"], "order-cancelled": ["AAR-2611-00042", "cancelled"], "order-cancelled-old": ["AAR-2609-00008", "cancelled"] };
    const last = placed ? store.get(K.order, null) : null;
    if (last) {
      o = { ...ORDERS["AAR-2611-00042"], ...last, rx: last.rx, addr: last.addr };
      status = "review"; example = false;
    } else {
      const [no, st] = map[STATE] || ["AAR-2611-00042", "review"];
      o = ORDERS[no]; status = st;
    }
    let reason = "";
    const t = totalsOf(o.items);
    const first = (Session.get() && Session.get().name ? Session.get().name : EX.user.name).split(" ")[0];

    function head() {
      const H = {
        review: [placed ? "Order placed" : "Pharmacist check", "clock", "", placed ? `Thank you, ${first}. Your order is placed.` : "A pharmacist is checking your order", placed ? "A pharmacist is now checking that your prescription covers each medicine. We’ll text and email you when your order is approved, then pack your medicines." : "They’re checking that your prescription covers each medicine. We’ll text and email you when your order is approved, then pack your medicines."],
        shipped: ["Shipped", "truck", "", "Your order is on its way", "Shipped on 17 Nov with Example Courier. Track it below."],
        delivered: ["Delivered", "check", "", "Delivered", `Delivered on ${o.no === "AAR-2610-00017" ? "26 Oct 2026" : "19 Nov 2026"}. Your invoice is ready to download.`],
        hold: ["On hold", "hold", "is-hold", "We need a new prescription", "Nothing has been packed. Upload a valid prescription to continue."],
        cancelled: ["Cancelled", "close", "is-off", "Order cancelled", o.no === "AAR-2609-00008" ? `₹${NF.format(t.pay / 100)} was refunded to the account you paid from on ${o.t.refunded}.` : `${inr(t.pay)} is on its way back to the account you paid from. It takes 5–7 working days.`],
      }[status];
      $("[data-headline]").textContent = H[3];
      $("[data-subline]").textContent = H[4];
      $("[data-order-no]").textContent = o.no;
      $("[data-order-date]").textContent = o.date;
      $("[data-order-packs]").textContent = packs(t.n);
      $("[data-order-total]").textContent = inr(t.pay);
      $("[data-ex]").hidden = !example;
      $("[data-back]").hidden = placed;
      const tag = $("[data-status-tag]");
      const TT = { review: ["wait", "Pharmacist check"], shipped: ["ok", "Shipped"], delivered: ["done", "Delivered"], hold: ["hold", "On hold"], cancelled: ["off", "Cancelled"] }[status];
      tag.className = `tag tag--${TT[0]}`;
      tag.textContent = TT[1];
      document.title = `${H[0]} · ${o.no} · Aarvion`;
      if (placed) $("[data-slip]").classList.add("print");
    }
    function timeline() {
      const T = o.t;
      const rows = [];
      const add = (cls, title, meta, text, ic) => rows.push({ cls, title, meta, text, ic });
      const pay = o.pay === "online" ? `Paid ${inr(t.pay)} online` : `Cash on delivery, ${inr(t.pay)}`;
      add("is-done", "Order placed", T.placed, pay, "check");
      if (status === "hold") {
        add("is-hold", "On hold: prescription not approved", "16 Nov, 12:05 pm", "Upload a newer one and the pharmacist will check it again.", "hold");
        ["Approved for this order", "Order confirmed", "Packed", "Shipped", "Delivered"].forEach((s) => add("is-todo", s, "", "", ""));
      } else if (status === "cancelled") {
        if (o.no === "AAR-2609-00008") {
          add("is-done", "Pharmacist checking this order", T.placed, "Stopped when the order was cancelled.", "clock");
          add("is-cancel", "Cancelled by you", T.cancelled, `Reason: ordered by mistake. ${inr(t.pay)} refunded on ${T.refunded}.`, "close");
        } else {
          add("is-done", "Pharmacist checking this order", T.placed, "Stopped when the order was cancelled.", "clock");
          add("is-cancel", "Cancelled by you", T.cancelled, `Reason: ${reason || "I ordered by mistake"}. Refund of ${inr(t.pay)} started; it takes 5–7 working days.`, "close");
        }
      } else {
        const order = ["review", "approved", "confirmed", "packed", "shipped", "delivered"];
        const reached = { review: 0, shipped: 4, delivered: 5 }[status];
        const titles = { review: "Pharmacist checking this order", approved: "Approved for this order", confirmed: "Order confirmed", packed: "Packed", shipped: "Shipped", delivered: "Delivered" };
        order.forEach((k, i) => {
          const isCur = i === reached && status !== "delivered";
          const isDone = i < reached || status === "delivered";
          let text = "";
          if (k === "review" && isCur) text = "A pharmacist is checking your prescription against this order.";
          if (k === "approved" && isDone) text = `Valid until ${o.no === "AAR-2610-00017" ? "20 Apr 2027" : "10 May 2027"}.`;
          if (k === "shipped" && (isCur || isDone)) text = `<span class="track"><span>Example Courier</span><span>Tracking no. <span class="mono">EXC 4821 0093 17</span></span><a class="link" href="#track" data-track>Track shipment${icon("ext")}</a></span>`;
          const meta = isDone || isCur ? (k === "review" ? T.placed : T[k]) : "";
          add(isCur ? "is-current" : isDone ? "is-done" : "is-todo", isCur && k === "shipped" ? "Shipped: on its way" : titles[k], meta, text, isDone ? "check" : "");
        });
      }
      $("[data-timeline]").innerHTML = rows.map((r) => `<li class="tl-item ${r.cls}"${r.cls === "is-current" || r.cls === "is-hold" ? ' aria-current="step"' : ""}><span class="tl-dot">${r.ic ? icon(r.ic) : ""}</span><div class="tl-body"><p class="tl-title">${r.title}${r.cls === "is-todo" ? '<span class="sr-only">, not yet</span>' : ""}</p>${r.meta ? `<p class="tl-meta">${r.meta}</p>` : ""}${r.text ? `<p class="tl-text">${r.text}</p>` : ""}</div></li>`).join("");
    }
    function details() {
      const list = $("[data-order-lines]");
      list.innerHTML = "";
      renderLines(list, o.items);
      $("[data-items-count]").textContent = packs(t.n);
      $("[data-order-sum]").innerHTML = sumHTML(t, "full");
      const P = $("[data-pay-tag]");
      const paid = o.pay === "online";
      if (status === "cancelled") { P.className = "tag tag--off"; P.textContent = paid ? (o.no === "AAR-2609-00008" ? "Refunded" : "Refund started") : "Not charged"; }
      else if (paid) { P.className = "tag tag--ok"; P.textContent = "Paid"; }
      else { P.className = "tag tag--wait"; P.textContent = status === "delivered" ? "Paid on delivery" : "Pay on delivery"; if (status === "delivered") P.className = "tag tag--ok"; }
      $("[data-pay-note]").innerHTML = paid ? `${icon("card")}<span>Paid by UPI through Razorpay.${status === "hold" || status === "review" ? " If the pharmacist can’t approve this order, you get a full refund." : ""}</span>` : `${icon("cash")}<span>Cash on delivery. Keep ${inr(t.pay)} ready for the courier.</span>`;
      if (!paid && status === "delivered") $("[data-pay-note]").innerHTML = `${icon("cash")}<span>Paid in cash on delivery.</span>`;
      $("[data-order-addr]").innerHTML = `<b>${esc(o.addr.name)}</b><br>${addrHTML(o.addr)}`;
      const rx = status === "hold" ? RX_OLD : o.rx;
      const rxTag = rx.tag || ["wait", "Under review"];
      $("[data-order-rx]").innerHTML = `<p><b>${esc(rx.file)}</b><br>Patient: ${esc(rx.patient)}</p><span class="tag tag--${rxTag[0]}">${esc(rxTag[1])}</span>${rx.why ? `<p class="opt-why">${icon("alert")}<span>${esc(rx.why)}</span></p>` : ""}${status === "review" ? `<p class="opt-why">${icon("clock")}<span>A pharmacist is matching it to this order.</span></p>` : ""}`;
      const hold = $("[data-hold]");
      hold.hidden = status !== "hold";
      if (status === "hold") hold.innerHTML = `<div class="note note--hold" role="status">${icon("alert")}<div><b>Your order is on hold.</b> ${HOLD_WHY} The pharmacist couldn’t approve it, so nothing has been packed. Your payment is safe: upload a valid prescription to continue, or cancel for a full refund.<div class="note-actions"><a class="btn btn-forest btn-sm" href="account.html#prescriptions">${icon("upload")}<span>Upload a new prescription</span></a><button class="btn btn-quiet btn-sm" type="button" data-cancel-open aria-haspopup="dialog">Cancel order</button></div></div></div>`;
      actions();
    }
    function actions() {
      const canCancel = status === "review" || status === "hold";
      const box = $("[data-actions]");
      box.innerHTML = `<button class="btn btn-quiet btn-block" type="button" data-reorder>${icon("refresh")}<span>Order these again</span></button>
${status === "cancelled" ? "" : status === "delivered" ? `<button class="btn btn-quiet btn-block" type="button" data-invoice>${icon("download")}<span>Download invoice</span></button>` : `<button class="btn btn-quiet btn-block" type="button" disabled aria-describedby="inv-why">${icon("download")}<span>Download invoice</span></button><p class="why" id="inv-why">The invoice is ready once the order is delivered.</p>`}
${canCancel ? `<button class="btn btn-danger-quiet btn-block" type="button" data-cancel-open aria-haspopup="dialog">Cancel order</button><p class="why">You can cancel until the order is packed.</p>` : ""}
${status === "shipped" ? `<p class="why">This order has shipped, so it can’t be cancelled now.</p>` : ""}
${status === "delivered" ? `<p class="why">If anything arrived damaged, wrong or expired, tell us within 48 hours of delivery.</p>` : ""}`;
    }
    head(); timeline(); details();

    document.addEventListener("click", (e) => {
      if (e.target.closest("[data-reorder]")) {
        const n = Cart.add(o.items);
        if (!n) { toast(`Your cart is full. One order can hold up to ${LIMIT_ORDER} packs.`, { ic: "info" }); return; }
        Sheets.open($("#cart-drawer"), e.target.closest("button"), "#cart-drawer-title");
        toast(`Added ${packs(n)} to your cart`);
      }
      if (e.target.closest("[data-invoice]")) toast("Prototype: the invoice PDF downloads here.", { ic: "download" });
      if (e.target.closest("[data-track]")) { e.preventDefault(); toast("Prototype: this opens the courier’s tracking page.", { ic: "ext" }); }
      const c = e.target.closest("[data-cancel-open]");
      if (c) openCancel(c);
    });
    const dlg = $("#cancel-dialog"), cform = $("[data-cancel-form]");
    function openCancel(trigger) {
      $("[data-cx-desc]").textContent = o.pay === "online"
        ? `You can cancel until the order is packed. ${inr(t.pay)} goes back to the account you paid from in 5–7 working days.`
        : "You can cancel until the order is packed. Nothing has been charged.";
      cform.reset();
      $$("input", cform).forEach((el) => showErr(el, ""));
      $("[data-cx-more]").hidden = true;
      Sheets.open(dlg, trigger, "#cx-title");
    }
    cform.addEventListener("change", (e) => { if (e.target.name === "cx") $("[data-cx-more]").hidden = e.target.value !== "other"; });
    cform.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (validate(cform).length) return;
      const r = $("input[name=cx]:checked", cform);
      reason = r.closest("label").textContent.trim();
      await busy($("[data-cx-go]"), "Cancelling…", 900);
      status = "cancelled";
      Sheets.close(dlg, { restore: false });
      head(); timeline(); details();
      $("[data-headline]").focus();
      toast("Order cancelled. Your refund has started.");
    });
  }

  /* ── Account ──────────────────────────────────────────────────────── */
  function initAccount() {
    if (!Session.in()) { location.replace("login.html?next=" + encodeURIComponent("account.html" + location.hash)); return; }
    const u = Session.get();
    const first = (u.name || EX.user.name).split(" ")[0];
    $("[data-hello]").textContent = `Hello, ${first}`;
    const ident = u.mobile ? fmtMobile(u.mobile) : u.email || fmtMobile(EX.user.mobile);
    $("[data-acct-sub]").innerHTML = `Signed in with <span class="mono">${esc(ident)}</span><span class="ex-tag">Example account</span>`;
    $("#pf-name").value = u.name || EX.user.name;
    const mrow = $("[data-channel=mobile] [data-ch-value]");
    if (u.mobile) mrow.textContent = fmtMobile(u.mobile);
    if (u.email) { $("[data-channel=email] [data-ch-value]").textContent = u.email; $("[data-channel=email] [data-ch-tag]").hidden = false; $("[data-channel=email] [data-ch-open]").firstChild.textContent = "Change"; }

    // Tabs (ARIA tabs, arrow keys, hash in sync)
    const tabs = $$("[role=tab]");
    const mqWide = matchMedia("(min-width: 961px)");
    const orient = () => $("[role=tablist]").setAttribute("aria-orientation", mqWide.matches ? "vertical" : "horizontal");
    orient();
    mqWide.addEventListener("change", orient);
    function select(name, focus) {
      const tab = tabs.find((t) => t.dataset.tab === name) || tabs[0];
      tabs.forEach((t) => {
        const on = t === tab;
        t.setAttribute("aria-selected", on);
        t.tabIndex = on ? 0 : -1;
        document.getElementById(t.getAttribute("aria-controls")).hidden = !on;
      });
      if (focus) tab.focus({ preventScroll: true });
      const list = tab.parentElement;
      if (list.scrollWidth > list.clientWidth) list.scrollTo({ left: Math.max(0, tab.offsetLeft - 16), behavior: focus && !mqReduce.matches ? "smooth" : "auto" });
      if (history.replaceState && location.hash.slice(1) !== tab.dataset.tab) history.replaceState(null, "", `${location.pathname}${location.search}#${tab.dataset.tab}`);
    }
    tabs.forEach((t, i) => {
      t.addEventListener("click", () => select(t.dataset.tab));
      t.addEventListener("keydown", (e) => {
        const k = e.key;
        let j = null;
        if (k === "ArrowDown" || k === "ArrowRight") j = (i + 1) % tabs.length;
        if (k === "ArrowUp" || k === "ArrowLeft") j = (i - 1 + tabs.length) % tabs.length;
        if (k === "Home") j = 0;
        if (k === "End") j = tabs.length - 1;
        if (j === null) return;
        e.preventDefault();
        select(tabs[j].dataset.tab, true);
      });
    });
    const fromState = { "account-addresses": "addresses", "account-prescriptions": "prescriptions", "account-orders": "orders", "account-privacy": "privacy" }[STATE];
    select(fromState || location.hash.slice(1) || "profile");
    addEventListener("hashchange", () => select(location.hash.slice(1)));

    // Profile
    $("[data-profile]").addEventListener("submit", (e) => {
      e.preventDefault();
      if (validate(e.currentTarget).length) return;
      const name = $("#pf-name").value.trim();
      Session.signIn({ ...Session.get(), name });
      $("[data-hello]").textContent = `Hello, ${name.split(" ")[0]}`;
      toast("Profile saved");
    });
    $$("[data-channel]").forEach((row) => {
      const kind = row.dataset.channel, box = $("[data-ch-box]", row), btn = $("[data-ch-open]", row);
      const P = "ch" + kind;
      box.innerHTML = `<form class="form" data-ch-id data-v novalidate>
  <div class="field">
    <label class="label" for="${P}-in">${kind === "mobile" ? "New mobile number" : "Email address"}</label>
    ${kind === "mobile"
      ? `<div class="input-wrap has-prefix"><span class="prefix" aria-hidden="true">+91</span><input class="input mono" id="${P}-in" type="tel" inputmode="numeric" autocomplete="tel-national" required data-rule="mobile" data-msg-required="Enter the new 10-digit mobile number."></div>`
      : `<input class="input" id="${P}-in" type="email" inputmode="email" autocomplete="email" autocapitalize="none" spellcheck="false" required data-rule="email" data-msg-required="Enter your email address." placeholder="name@example.com">`}
  </div>
  <div class="cstep-actions"><button class="btn btn-forest" type="submit">Send code</button><button class="btn btn-quiet" type="button" data-ch-cancel>Cancel</button></div>
</form>
<form class="form" data-ch-code novalidate hidden>
  <div class="field">
    <label class="label" for="${P}-otp">Code sent to <b data-ch-to class="mono"></b></label>
    <div class="otp" data-otp><input class="otp-input" id="${P}-otp" type="text" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]*" maxlength="6" spellcheck="false"><div class="otp-boxes" aria-hidden="true">${'<span class="otp-box"></span>'.repeat(6)}</div></div>
    <p class="auth-alert" id="${P}-err" data-otp-alert hidden>${icon("alert")}<span></span></p>
  </div>
  <div class="cstep-actions"><button class="btn btn-forest" type="submit">Verify</button><button class="btn btn-quiet" type="button" data-ch-cancel>Cancel</button></div>
  <p class="demo-note">${icon("info")}<span>Prototype: use <b>123456</b></span></p>
</form>`;
      const idf = $("[data-ch-id]", box), cf = $("[data-ch-code]", box), alertBox = $("[data-otp-alert]", box);
      let val = "";
      const otp = OTP($("[data-otp]", box), { onComplete: () => cf.requestSubmit() });
      const toggle = (on) => {
        box.hidden = !on;
        btn.setAttribute("aria-expanded", on);
        if (on) { idf.hidden = false; cf.hidden = true; idf.reset(); $(`#${P}-in`).focus(); } else btn.focus();
      };
      btn.addEventListener("click", () => toggle(box.hidden));
      $$("[data-ch-cancel]", box).forEach((c) => c.addEventListener("click", () => toggle(false)));
      idf.addEventListener("submit", async (e) => {
        e.preventDefault();
        if (validate(idf).length) return;
        const raw = $(`#${P}-in`).value.trim();
        val = kind === "mobile" ? fmtMobile(normMobile(raw)) : raw.toLowerCase();
        await busy($("button[type=submit]", idf), "Sending code…", 600);
        $("[data-ch-to]", cf).textContent = val;
        idf.hidden = true; cf.hidden = false; otp.clear();
        otp.el.focus();
        say(`We sent a 6-digit code to ${val}.`);
      });
      cf.addEventListener("submit", async (e) => {
        e.preventDefault();
        if (otp.el.value === "123456") {
          await busy($("button[type=submit]", cf), "Checking…", 500);
          $("[data-ch-value]", row).textContent = val;
          $("[data-ch-tag]", row).hidden = false;
          btn.firstChild.textContent = "Change";
          toggle(false);
          toast(kind === "mobile" ? "Mobile number changed and verified" : "Email added and verified");
        } else {
          $("span", alertBox).textContent = otp.el.value.length < 6 ? "Enter all 6 digits of the code." : "That code doesn’t match. Check it and try again.";
          alertBox.hidden = false;
          otp.invalid(true);
          otp.el.focus();
          otp.el.select();
          say($("span", alertBox).textContent);
        }
      });
    });
    $("[data-signout]").addEventListener("click", () => { Session.signOut(); location.href = "login.html"; });

    // Addresses
    const cards = $("[data-addr-cards]"), aform = $("#ac-form"), aadd = $("[data-addr-add]");
    let editing = null;
    function renderCards() {
      cards.innerHTML = ADDR.map((a) => `<li class="card${a.def ? " is-default" : ""}" data-id="${a.id}"><p class="card-title">${esc(a.name)}${a.def ? ' <span class="tag tag--ok">Default</span>' : ""}</p><address>${addrHTML(a)}</address><div class="card-actions"><button class="link" type="button" data-a-edit>Edit<span class="sr-only"> ${esc(a.name)}’s address</span></button>${a.def ? "" : `<button class="link" type="button" data-a-def>Set as default<span class="sr-only">: ${esc(a.name)}</span></button><button class="link link-danger" type="button" data-a-del>Remove<span class="sr-only"> ${esc(a.name)}’s address</span></button>`}</div></li>`).join("");
      $("[data-addr-count]").textContent = `${ADDR.length} of 10`;
      $("[data-addr-n]").textContent = ADDR.length;
      aadd.disabled = ADDR.length >= 10;
    }
    function openA(a) {
      editing = a ? a.id : null;
      aform.hidden = false;
      aadd.setAttribute("aria-expanded", "true");
      fillAddr(aform, a);
      $("[data-form-title]", aform).textContent = a ? "Edit address" : "New address";
      $("#ac-name").focus();
    }
    const closeA = () => { aform.hidden = true; aadd.setAttribute("aria-expanded", "false"); editing = null; };
    aadd.addEventListener("click", () => openA(null));
    $("[data-addr-cancel]", aform).addEventListener("click", () => { closeA(); aadd.focus(); });
    aform.addEventListener("submit", (e) => {
      e.preventDefault();
      if (validate(aform, $("[data-errsum]", aform)).length) return;
      const a = readAddr(aform);
      if (editing) { const i = ADDR.findIndex((x) => x.id === editing); a.id = editing; a.def = a.def || ADDR[i].def; ADDR[i] = a; }
      else ADDR.push(a);
      if (a.def || ADDR.length === 1) setDefault(a.id);
      closeA();
      renderCards();
      toast(editing ? "Address updated" : "Address saved");
      aadd.focus();
    });
    cards.addEventListener("click", (e) => {
      const li = e.target.closest("[data-id]");
      if (!li) return;
      const a = ADDR.find((x) => x.id === li.dataset.id);
      if (e.target.closest("[data-a-edit]")) openA(a);
      if (e.target.closest("[data-a-def]")) { setDefault(a.id); renderCards(); toast(`${a.name}’s address is now the default`); $(`[data-id="${a.id}"] [data-a-edit]`).focus(); }
      if (e.target.closest("[data-a-del]")) {
        const i = ADDR.indexOf(a);
        ADDR.splice(i, 1);
        renderCards();
        aadd.focus();
        toast("Address removed", { action: "Undo", ic: "trash", onAction: () => { ADDR.splice(i, 0, a); renderCards(); } });
      }
    });
    renderCards();

    // Prescriptions
    const rxf = $("[data-rx-form]"), rxOpen = $$("[data-rx-open]");
    const rup = Upload($("[data-upload]", rxf));
    const openRx = (on) => {
      rxf.hidden = !on;
      rxOpen.forEach((b) => b.hasAttribute("aria-expanded") && b.setAttribute("aria-expanded", on));
      if (on) { $("h3", rxf).focus(); rxf.scrollIntoView({ block: "nearest" }); } else rxOpen[0].focus();
    };
    rxOpen.forEach((b) => b.addEventListener("click", () => openRx(true)));
    $("[data-rx-cancel]").addEventListener("click", () => openRx(false));
    rxf.addEventListener("submit", async (e) => {
      e.preventDefault();
      const hasFile = rup.need();
      const errs = validate(rxf, null);
      const all = hasFile ? errs : [{ el: $("#ar-pick"), msg: "Add a photo or PDF of the prescription." }, ...errs];
      errSummary($("[data-errsum]", rxf), all);
      if (all.length) return;
      await busy($("button[type=submit]", rxf), "Sending…", 800);
      const li = document.createElement("li");
      li.className = "rx-item";
      li.innerHTML = `<span class="rx-doc" aria-hidden="true"><span>Rx</span></span><div><p class="rx-title"></p><p class="rx-meta"></p></div><span class="tag tag--wait">Under review</span><p class="rx-why">${icon("pharm")}<span>A pharmacist is checking it. We’ll text you when it’s done.</span></p>`;
      $(".rx-title", li).textContent = $("#ar-patient").value.trim();
      $(".rx-meta", li).textContent = `${rup.file.name} · uploaded today`;
      $("[data-rx-list]").prepend(li);
      openRx(false);
      toast("Prescription sent for review");
    });

    // Privacy
    const sw = $("[data-switch]");
    sw.addEventListener("click", () => {
      const on = sw.getAttribute("aria-checked") !== "true";
      sw.setAttribute("aria-checked", on);
      toast(on ? "You’ll hear about new Aarvion medicines" : "We won’t send you news about new medicines");
    });
    $("[data-export]").addEventListener("click", async (e) => {
      await busy(e.currentTarget, "Requesting…", 700);
      e.currentTarget.hidden = true;
      $("[data-export-ok]").hidden = false;
      say($("[data-export-ok]").textContent);
    });
    $("[data-delete]").addEventListener("click", (e) => Sheets.open($("#delete-dialog"), e.currentTarget, "#del-title"));
    $("[data-delete-go]").addEventListener("click", async (e) => {
      await busy(e.currentTarget, "Requesting…", 800);
      Sheets.close($("#delete-dialog"), { restore: false });
      $("[data-delete]").hidden = true;
      $("[data-delete-ok]").hidden = false;
      $("[data-delete-ok]").setAttribute("tabindex", "-1");
      $("[data-delete-ok]").focus();
      say($("[data-delete-ok]").textContent);
    });
  }

  /* ── Prototype states nav ─────────────────────────────────────────── */
  function markProto() {
    $$(".proto a").forEach((a) => {
      const u = new URL(a.getAttribute("href"), location.href);
      const s = u.searchParams.get("state") || "";
      const here = u.pathname.split("/").pop() === location.pathname.split("/").pop();
      const match = here && (s === STATE || (!s && !STATE && !params.get("placed")) || (s === "checkout" && !STATE && PAGE === "checkout") || (s === "account-profile" && !STATE && PAGE === "account") || (s === "order-placed" && !STATE && PAGE === "order"));
      if (match) a.setAttribute("aria-current", "true");
    });
  }

  /* ── Boot ─────────────────────────────────────────────────────────── */
  initNav();
  renderAcct();
  renderCart();
  initDock();
  initAuth();
  markProto();
  if (PAGE === "checkout") initCheckout();
  if (PAGE === "order") initOrder();
  if (PAGE === "account") initAccount();
  if (STATE === "cart-drawer-open") Sheets.open($("#cart-drawer"), $("[data-cart-open]"), "#cart-drawer-title");
  if (STATE === "login-dialog") openLogin($("[data-acct]"), "");
})();
