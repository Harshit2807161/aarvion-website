/* Aarvion home: the banner carousel, the cart (Add becomes the stepper; the header count follows),
   the rails' arrows, prescription upload, and the film engine for the ordering act, the category
   bento, the rails' rise and the close: one passive scroll listener and one rAF tick, writing
   --ti / --to that CSS turns into transform and opacity. The header search lives in store.js.
   No libraries. */
(() => {
  const d = document, R = d.documentElement;
  const $ = (s, c = d) => c.querySelector(s), $$ = (s, c = d) => [...c.querySelectorAll(s)];
  const film = matchMedia("(prefers-reduced-motion: no-preference)").matches;
  const qs = location.search, DEMO = /demo=states/.test(qs);
  const say = (t) => { const l = $("#live"); l.textContent = ""; setTimeout(() => (l.textContent = t), 40); };
  const cl = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
  if (film) R.classList.add("film");

  /* ── Film engine ───────────────────────────────────────────────────── */
  const E = { lin: (t) => t, out: (t) => 1 - (1 - t) ** 3, in: (t) => t * t * t, io: (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2) };
  const rg = (s) => s && ((s = s.split(" ")), [+s[0], +s[1], E[s[2] || "lin"]]);
  const val = (r, p) => +r[2](cl((p - r[0]) / (r[1] - r[0]))).toFixed(4);
  const NUM = { how: 3, areas: 4, close: 5 }; // ?p=<act>:<progress> for captures (.tools/acts.mjs)
  const acts = $$("[data-act]").map((el) => ({
    el, st: $(".stage", el), pin: el.dataset.act == "pin", on: 0, p: -1,
    xs: [el, ...$$("[data-in],[data-out]", el)].filter((a) => a.dataset.in || a.dataset.out)
      .map((a) => ({ a, i: rg(a.dataset.in), o: rg(a.dataset.out), vi: -1, vo: -1 })),
  }));
  const steps = $$(".step");
  let q = 0, si = -1;
  const hooks = {
    how(p) {
      const i = p < 0.34 ? 0 : p < 0.67 ? 1 : 2;
      if (i !== si) { si = i; steps.forEach((s, k) => s.classList.toggle("is-active", k === i)); }
    },
  };

  function measure() {
    const vh = innerHeight, y = scrollY;
    R.classList.add("measuring");
    for (const A of acts) {
      const r = A.el.getBoundingClientRect();
      A.top = r.top + y - (A.pin ? 0 : vh);
      A.len = Math.max(1, A.pin ? A.el.offsetHeight - A.st.offsetHeight : r.height + vh);
      if (A.el.hasAttribute("data-lead")) { A.top -= vh; A.len += vh; }
      A.p = -1;
    }
    R.classList.remove("measuring");
    tick();
  }
  function tick() {
    q = 0;
    const y = scrollY;
    for (const A of acts) {
      if (!A.on) continue;
      const p = cl((y - A.top) / A.len);
      if (p === A.p) continue;
      A.p = p;
      for (const x of A.xs) {
        if (x.i) { const v = val(x.i, p); if (v !== x.vi) { x.vi = v; x.a.style.setProperty("--ti", v); } }
        if (x.o) { const v = val(x.o, p); if (v !== x.vo) { x.vo = v; x.a.style.setProperty("--to", v); } }
      }
      hooks[A.el.id] && hooks[A.el.id](p);
    }
  }
  const dirty = () => { if (!q) { q = 1; requestAnimationFrame(tick); } };
  if (film) {
    const io = new IntersectionObserver((es) => {
      for (const e of es) {
        const A = e.target._a;
        A.on = e.isIntersecting; A.p = -1;
        A.el.classList.toggle("live", A.on);
      }
      dirty();
    }, { rootMargin: "100% 0px" });
    acts.forEach((A) => { A.el._a = A; io.observe(A.el); });
    addEventListener("scroll", dirty, { passive: true });
  }
  let rt;
  const remeasure = () => { clearTimeout(rt); rt = setTimeout(measure, 120); };
  addEventListener("resize", remeasure, { passive: true });
  new ResizeObserver(remeasure).observe(d.body);

  /* ── Banner carousel ───────────────────────────────────────────────── */
  // Desktop: slides stack and cross-fade (opacity and transform only). Phones: a native
  // scroll-snap row with the next slide peeking; the scroll position is the truth. Autoplay runs
  // on the current dot's 6s fill (its animationend advances), so every pause holds the clock where
  // it is. Held by hover, focus inside, touch, a hidden tab or the banner being off screen; stopped
  // by the user's pause control; never started under reduced motion.
  const hero = $("[data-carousel]");
  const carousel = hero && (() => {
    const track = $(".hero-track", hero), slides = $$(".slide", hero), dots = $$(".hero-dot", hero), play = $("[data-play]", hero);
    const n = slides.length, mq = matchMedia("(max-width: 719px)"), holds = new Set();
    let cur = 0, stopped = !film, ready = false, leave = 0, settle = 0, touchT = 0;
    hero.classList.toggle("no-auto", !film);
    function state() {
      const held = holds.size > 0;
      hero.classList.toggle("is-auto", ready && !stopped);
      hero.classList.toggle("is-held", held);
      hero.classList.toggle("is-stopped", stopped && film);
      track.setAttribute("aria-live", !stopped && !held ? "off" : "polite");
      play.setAttribute("aria-label", stopped ? "Start automatic slide show" : "Stop automatic slide show");
    }
    const hold = (why, on) => { holds[on ? "add" : "delete"](why); state(); };
    function mark(i) {
      cur = i;
      dots.forEach((b, k) => b.setAttribute("aria-current", k === i ? "true" : "false"));
      slides.forEach((s, k) => { s.inert = !mq.matches && k !== i; });
    }
    const left = (i) => slides[i].offsetLeft - slides[0].offsetLeft;
    function go(i) {
      i = (i + n) % n;
      if (mq.matches) { track.scrollTo({ left: left(i), behavior: film ? "smooth" : "auto" }); return; }
      if (i === cur) return;
      const out = slides[cur];
      clearTimeout(leave);
      slides.forEach((s) => s.classList.remove("is-leaving"));
      out.classList.replace("is-current", "is-leaving");
      slides[i].classList.add("is-current");
      leave = setTimeout(() => out.classList.remove("is-leaving"), film ? 760 : 0);
      mark(i);
    }
    // phones: the slide whose start is nearest the track's scroll position is current
    track.addEventListener("scroll", () => {
      if (!mq.matches) return;
      clearTimeout(settle);
      settle = setTimeout(() => {
        const x = track.scrollLeft, max = track.scrollWidth - track.clientWidth;
        let i = 0;
        slides.forEach((s, k) => { if (Math.abs(left(k) - x) < Math.abs(left(i) - x)) i = k; });
        if (x >= max - 2) i = n - 1;
        if (i !== cur) mark(i);
      }, 90);
    }, { passive: true });
    function sync() {
      slides.forEach((s, k) => { s.classList.toggle("is-current", k === cur); s.classList.remove("is-leaving"); });
      mark(cur);
      if (mq.matches) track.scrollLeft = left(cur);
    }
    mq.addEventListener("change", sync);

    hero.addEventListener("click", (e) => {
      const b = e.target.closest("button");
      if (!b) return;
      if (b.hasAttribute("data-play")) { stopped = !stopped; state(); }
      else if (b.hasAttribute("data-prev")) go(cur - 1);
      else if (b.hasAttribute("data-next")) go(cur + 1);
      else if (b.classList.contains("hero-dot")) go(dots.indexOf(b));
    });
    hero.addEventListener("animationend", (e) => { if (e.animationName === "dot-run" && !stopped && !holds.size) go(cur + 1); });
    hero.addEventListener("pointerenter", (e) => e.pointerType === "mouse" && hold("hover", true));
    hero.addEventListener("pointerleave", (e) => e.pointerType === "mouse" && hold("hover", false));
    hero.addEventListener("focusin", () => hold("focus", true));
    hero.addEventListener("focusout", (e) => { if (!hero.contains(e.relatedTarget)) hold("focus", false); });
    track.addEventListener("pointerdown", (e) => { if (e.pointerType !== "mouse") { clearTimeout(touchT); hold("touch", true); } });
    const untouch = (e) => { if (e.pointerType !== "mouse") { clearTimeout(touchT); touchT = setTimeout(() => hold("touch", false), 4000); } };
    track.addEventListener("pointerup", untouch);
    track.addEventListener("pointercancel", untouch);
    d.addEventListener("visibilitychange", () => hold("hidden", d.hidden));
    new IntersectionObserver(([e]) => hold("away", !e.isIntersecting)).observe(track);
    sync();
    state();
    return {
      start() { ready = true; hero.classList.add("is-ready"); state(); },
      stop() { stopped = true; state(); },
      go,
    };
  })();

  /* ── Cart: the same store as the cart page (localStorage), 10 a medicine, 20 an order ── */
  const KEY = "aarvion.cart.v1", EACH = 10, ORDER = 20, mem = {};
  const stash = {
    get() { if (DEMO) return null; try { return JSON.parse(localStorage.getItem(KEY) || "null"); } catch (e) { return mem.v || null; } },
    set(v) { mem.v = v; if (DEMO) return; try { localStorage.setItem(KEY, JSON.stringify(v)); } catch (e) { /* private mode: memory only */ } },
  };
  const cart = {};
  const saved = stash.get();
  if (saved && Array.isArray(saved.items)) saved.items.forEach((i) => { if (i.qty > 0) cart[i.slug] = Math.min(EACH, i.qty | 0); });
  const total = () => Object.values(cart).reduce((a, b) => a + b, 0);
  const cnt = $(".sh-cart .cart-count"), cartLink = $(".sh-cart");
  function count(bump) {
    const t = total();
    cnt.textContent = t;
    cartLink.setAttribute("aria-label", `Cart, ${t} ${t == 1 ? "pack" : "packs"}`);
    if (bump && film) cnt.animate([{ transform: "scale(1.35)" }, { transform: "none" }], { duration: 260, easing: "cubic-bezier(0.23, 1, 0.32, 1)" });
  }
  function paint(s) {
    const n = cart[s] || 0;
    $$(`.pocket[data-slug="${s}"] .cart-ctl`).forEach((c) => { c.dataset.qty = n; $("output", c).value = n; });
  }
  function limits() {
    const full = total() >= ORDER;
    $$(".pocket .cart-ctl").forEach((c) => {
      const n = +c.dataset.qty;
      $("[data-inc]", c).setAttribute("aria-disabled", n >= EACH || full);
      $("[data-add]", c).setAttribute("aria-disabled", full);
    });
  }
  const save = () => stash.set({ items: Object.entries(cart).filter(([, n]) => n > 0).map(([slug, qty]) => ({ slug, qty })), seeded: false });
  Object.keys(cart).forEach(paint);
  limits();
  count(false);

  const file = $("#rx-file");
  d.addEventListener("click", (e) => {
    const t = e.target, b = t.closest("[data-add],[data-inc],[data-dec]");
    if (b) {
      const p = b.closest("[data-slug]"), s = p.dataset.slug, c = b.closest(".cart-ctl"), name = p.dataset.name;
      if (b.getAttribute("aria-disabled") == "true") {
        say(total() >= ORDER ? `An order can hold up to ${ORDER} packs.` : `You can order up to ${EACH} packs of ${name}.`);
        return;
      }
      const n = (cart[s] = Math.max(0, Math.min(EACH, (cart[s] || 0) + (b.hasAttribute("data-dec") ? -1 : 1))));
      if (!n) delete cart[s];
      paint(s); limits(); count(true); save();
      if (b.hasAttribute("data-add")) $("[data-inc]", c).focus(); else if (!n) $("[data-add]", c).focus();
      say(n ? `${name}: ${n} in cart` : `${name} removed from cart`);
      return;
    }
    const a = t.closest("[data-rx]");
    if (a) { e.preventDefault(); file.click(); }
  });
  file.addEventListener("change", () => {
    const f = file.files[0], m = f ? `${f.name} attached. You’ll confirm it at checkout.` : "";
    $("#rx-status").textContent = m;
  });

  /* ── Rails: while a strip is longer than the page, arrows page it and "View all N"
     opens it in place into a wrapping sheet ("Show fewer" closes it). A rail that already shows
     every pocket offers neither: its count says it is the whole category. ── */
  $$(".rail").forEach((r) => {
    const row = $(".rail-row", r), arrows = $(".rail-arrows", r), [back, fwd] = $$(".rail-btn", r);
    const all = $(".rail-all", r), label = $(".rail-all-t", all);
    let t = 0, open = false;
    const upd = () => {
      const max = row.scrollWidth - row.clientWidth;
      all.hidden = !open && max <= 2;
      arrows.hidden = open || max <= 2;
      back.setAttribute("aria-disabled", row.scrollLeft <= 2);
      fwd.setAttribute("aria-disabled", row.scrollLeft >= max - 2);
    };
    all.addEventListener("click", () => {
      open = !open;
      r.classList.toggle("is-open", open);
      row.classList.toggle("is-grid", open);
      all.setAttribute("aria-expanded", open);
      label.textContent = open ? label.dataset.less : label.dataset.more;
      if (open) row.scrollLeft = 0;
      else if (r.getBoundingClientRect().top < 0) r.scrollIntoView({ block: "start" }); // closing a long sheet: back to its head
      upd();
      say(open ? `${r.querySelector(".h-section").textContent}: all ${row.children.length} medicines shown` : "Showing one row");
    });
    row.addEventListener("scroll", () => { clearTimeout(t); t = setTimeout(upd, 80); }, { passive: true });
    new ResizeObserver(upd).observe(row);
    arrows.addEventListener("click", (e) => {
      const b = e.target.closest("[data-rail]");
      if (!b || b.getAttribute("aria-disabled") == "true") return;
      row.scrollBy({ left: +b.dataset.rail * row.clientWidth * 0.8, behavior: film ? "smooth" : "auto" });
    });
  });

  /* ── Start ─────────────────────────────────────────────────────────── */
  measure();
  const start = () => {
    measure();
    carousel && carousel.start();
    const m = /[?&]p=(\d):([\d.]+)/.exec(qs), A = m && acts.find((a) => NUM[a.el.id] == m[1]);
    if (A) scrollTo(0, Math.round(A.top + cl(+m[2]) * A.len));
    if (DEMO) {
      // a review frame: one pack in the cart, the banner stopped on slide 2, search open on "sacu"
      cart["sacuwin-100"] = 1; paint("sacuwin-100"); limits(); count(false);
      carousel && (carousel.stop(), carousel.go(1));
      const q = $("#q");
      q.value = "sacu"; q.focus({ preventScroll: true }); q.dispatchEvent(new Event("input"));
      q.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown" }));
      q.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown" }));
    }
    // after load, fetch what is still lazy (the other banners, the lower shelves) so nothing pops in
    setTimeout(() => $$('img[loading="lazy"]').forEach((i) => (i.loading = "eager")), 300);
  };
  d.readyState == "complete" ? start() : addEventListener("load", start);
})();
