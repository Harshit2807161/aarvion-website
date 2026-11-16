/* Aarvion home: progressive enhancement. Search, cart, menu, upload, and the
   scroll film (one passive scroll listener + one rAF tick). No libraries. */
(() => {
  const d = document, R = d.documentElement, W = window;
  const $ = (s, c = d) => c.querySelector(s), $$ = (s, c = d) => [...c.querySelectorAll(s)];
  const film = matchMedia("(prefers-reduced-motion: no-preference)").matches;
  const qs = location.search, nav = $(".nav"), live = $("#live");
  const say = (t) => { live.textContent = ""; setTimeout(() => (live.textContent = t), 40); };
  const cl = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
  const set = (el, o) => { for (const k in o) el.style.setProperty(k, o[k]); };
  const mid = (r) => [r.left + r.width / 2, r.top + r.height / 2];
  if (film) R.classList.add("film");

  /* ── Film engine ───────────────────────────────────────────────────── */
  const E = { lin: (t) => t, out: (t) => 1 - (1 - t) ** 3, in: (t) => t * t * t, io: (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2) };
  const rg = (s) => s && ((s = s.split(" ")), [+s[0], +s[1], E[s[2] || "lin"]]);
  const val = (r, p) => +r[2](cl((p - r[0]) / (r[1] - r[0]))).toFixed(4);
  const NUM = { top: 1, price: 2, how: 3, areas: 4, close: 5 };
  const acts = $$("[data-act]").map((el) => ({
    el, st: $(".stage", el), pin: el.dataset.act == "pin", on: 0, p: -1,
    xs: [el, ...$$("[data-in],[data-out]", el)].filter((a) => a.dataset.in || a.dataset.out)
      .map((a) => ({ a, i: rg(a.dataset.in), o: rg(a.dataset.out), vi: -1, vo: -1 })),
  }));
  let grounds = [], vh = 0, q = 0, heroWhite = 0, si = -1;
  const list = $("#sugg"), input = $("#q"), heroStage = $(".act-hero .stage"), steps = $$(".step");

  const hooks = {
    top(p) {
      heroWhite = p > 0.42;
      heroStage.classList.toggle("gone", p > 0.25);
      if (p > 0.02 && !list.hidden) close();
    },
    how(p) {
      const i = p < 0.34 ? 0 : p < 0.67 ? 1 : 2;
      if (i !== si) { si = i; steps.forEach((s, k) => s.classList.toggle("is-active", k === i)); }
    },
  };

  function geo() {
    const w = $(".strip-wrap"), fl = $(".flyer"), S = heroStage.getBoundingClientRect(), Wr = w.getBoundingClientRect();
    // The flyer's size and exit growth are CSS (the same on every DPR): as it grows it crossfades
    // to its blurred twin, which hides the upscale. Here it only learns where its pocket is.
    const I = $(".pocket--lead .pocket-img").getBoundingClientRect(), F = fl.getBoundingClientRect(); // transforms are off while measuring
    // The fill takes over from the part of the plate that is on screen (mobile scrolls the strip).
    const Pr = $(".strip-plate").getBoundingClientRect(), G = $(".fill").getBoundingClientRect();
    const pl = Math.max(Pr.left, S.left), P = { left: pl, top: Pr.top, width: Math.min(Pr.right, S.right) - pl, height: Pr.height };
    const [, sy] = mid(S), [wx, wy] = mid(Wr), [ix, iy] = mid(I), [px, py] = mid(P), [gx, gy] = mid(G), cy = (sy - wy) * 0.55;
    set(w, { "--cy": cy + "px" });
    set(fl, { "--fx": ix - wx + "px", "--fy": iy - wy + "px", "--fs": I.width / F.width });
    set($(".fill"), { "--gx": px - gx + "px", "--gy": py + cy - gy + "px", "--gsx": (P.width * 1.14) / G.width, "--gsy": (P.height * 1.14) / G.height });
    for (const [g, b, t] of [[".big-mrp", ".dm-box--mrp", ".stamp-mrp .dm"], [".big-price", ".dm-box--price", ".stamp-price .dm"]]) {
      const B = $(b).getBoundingClientRect(), T = $(".pocket--feature " + t).getBoundingClientRect(), Gr = $(g).getBoundingClientRect();
      const [tx, ty] = mid(T), [bx, by] = mid(Gr);
      set($(g), { "--dx": tx - bx + "px", "--dy": ty - by + "px", "--ds": T.width / B.width });
    }
  }

  function measure() {
    vh = innerHeight;
    R.classList.add("measuring");
    const y = scrollY;
    for (const A of acts) {
      const r = A.el.getBoundingClientRect();
      A.top = r.top + y - (A.pin ? 0 : vh);
      A.len = Math.max(1, A.pin ? A.el.offsetHeight - A.st.offsetHeight : r.height + vh);
      if (A.el.hasAttribute("data-lead")) { A.top -= vh; A.len += vh; }
      A.p = -1;
    }
    grounds = $$("[data-ground]").map((el) => { const r = el.getBoundingClientRect(); return { el, t: r.top + y, b: r.bottom + y, g: el.dataset.ground }; });
    if (film) geo();
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
    const z = y + 44;
    let g = "white";
    for (const s of grounds) if (z >= s.t && z < s.b) { g = s.el.id == "top" && heroWhite ? "white" : s.g; break; }
    nav.classList.toggle("on-light", g != "forest");
  }
  const dirty = () => { if (!q) { q = 1; requestAnimationFrame(tick); } };

  if (film) {
    const io = new IntersectionObserver((es) => {
      for (const e of es) {
        const A = e.target._a;
        A.on = e.isIntersecting; A.p = -1;
        A.el.classList.toggle("live", A.on);
        if (A.on) $$("img", A.el).forEach((i) => { i.loading = "eager"; i.decode().catch(() => {}); });
      }
      dirty();
    }, { rootMargin: "100% 0px" });
    acts.forEach((A) => { A.el._a = A; io.observe(A.el); });
  }
  let rt;
  const remeasure = () => { clearTimeout(rt); rt = setTimeout(() => { measure(); film && drawDots(); }, 120); };
  addEventListener("scroll", dirty, { passive: true });
  addEventListener("resize", remeasure, { passive: true });
  new ResizeObserver(remeasure).observe(d.body);
  film && $(".strip").addEventListener("scroll", () => {
    clearTimeout(rt);
    rt = setTimeout(() => { R.classList.add("measuring"); geo(); R.classList.remove("measuring"); }, 120);
  }, { passive: true });

  /* Dot-matrix stamps: sample the glyphs once, draw dots into canvases */
  let dotW = 0;
  async function drawDots() {
    const boxes = $$("[data-dm]");
    if (!boxes[0] || boxes[0].clientWidth === dotW) return;
    dotW = boxes[0].clientWidth;
    try { await d.fonts.load('600 24px "Geist Mono"', "MRP ₹407"); } catch (e) {}
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (const box of boxes) {
      const t = box.dataset.dm, cs = $$("canvas", box), n = cs.length, F = 24, font = `600 ${F}px "Geist Mono", monospace`;
      const o = d.createElement("canvas").getContext("2d", { willReadFrequently: true });
      o.font = font;
      const w = Math.ceil(o.measureText(t).width);
      o.canvas.width = w; o.canvas.height = F;
      o.font = font; o.textBaseline = "middle"; o.fillText(t, 0, F * 0.54);
      const px = o.getImageData(0, 0, w, F).data, bw = box.clientWidth, bh = box.clientHeight, k = bw / w, ky = bh / F;
      const dpr = Math.min(2, devicePixelRatio || 1), ink = getComputedStyle(box).color;
      const cx = cs.map((c) => { c.width = Math.round(bw * dpr); c.height = Math.round(bh * dpr); const x = c.getContext("2d"); x.scale(dpr, dpr); x.fillStyle = ink; return x; });
      for (let y = 0; y < F; y++) for (let x = 0; x < w; x++) if (px[(y * w + x) * 4 + 3] > 110) {
        const c = cx[Math.min(n - 1, Math.floor((x / w * 0.72 + rnd() * 0.28) * n))];
        c.beginPath(); c.arc((x + 0.5) * k, (y + 0.5) * ky, k * 0.4, 0, 6.3); c.fill();
      }
    }
  }

  /* ── Search ────────────────────────────────────────────────────────── */
  const items = $$(".meds .pocket").map((el) => ({ el, ...el.dataset, key: (el.dataset.name + " " + el.dataset.salt).toLowerCase() }));
  const chips = $$(".chip");
  let res = [], cur = -1, str = "";
  const esc = (s) => s.replace(/[&<>"]/g, (c) => "&#" + c.charCodeAt(0) + ";");
  const hl = (s, ws) => ws.reduce((h, w) => h.replace(new RegExp("(" + w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ")(?![^<]*>)", "ig"), "<mark>$1</mark>"), esc(s));
  function find() {
    const v = input.value.trim().toLowerCase(), ws = v ? v.split(/\s+/) : [];
    res = v || str ? items.filter((it) => ws.every((w) => it.key.includes(w)) && (!str || it.strength.split(" ").includes(str))) : [];
    cur = -1;
    const open = !!(v || str);
    list.hidden = !open;
    input.setAttribute("aria-expanded", open);
    input.removeAttribute("aria-activedescendant");
    list.innerHTML = res.length
      ? res.map((it, i) => `<li role="option" id="o${i}" class="sugg-opt" aria-selected="false"><img src="${it.img}" alt="" width="44" height="44"><span class="sugg-main"><span class="sugg-name">${hl(it.name, ws)}</span><span class="sugg-meta">${hl(it.salt, ws)} · ${esc(it.pack)}</span></span><span class="sugg-price"><s>MRP ₹${it.mrp}</s><b>₹${it.price}</b></span></li>`).join("")
      : `<li class="sugg-empty">No medicine matches. Try a brand such as Sacuwin or a salt such as Valsartan.</li>`;
    if (open) say(res.length ? `${res.length} ${res.length == 1 ? "medicine" : "medicines"} found` : "No medicine matches");
  }
  function mark(i) {
    cur = i;
    $$(".sugg-opt", list).forEach((o, k) => o.setAttribute("aria-selected", k === i));
    if (i >= 0) { input.setAttribute("aria-activedescendant", "o" + i); $("#o" + i).scrollIntoView({ block: "nearest" }); }
  }
  function close() { list.hidden = true; input.setAttribute("aria-expanded", "false"); input.removeAttribute("aria-activedescendant"); cur = -1; }
  function choose(it) {
    close();
    $$(".is-found").forEach((x) => x.classList.remove("is-found"));
    it.el.scrollIntoView({ block: "center" });
    it.el.classList.add("is-found");
    const c = $(".cart-ctl", it.el);
    $(c.dataset.qty == "0" ? "[data-add]" : "[data-inc]", c).focus({ preventScroll: true });
  }
  input.addEventListener("input", find);
  input.addEventListener("focus", () => (input.value || str) && find());
  input.addEventListener("keydown", (e) => {
    const n = res.length, k = e.key;
    if (k == "ArrowDown" || k == "ArrowUp") {
      e.preventDefault();
      if (list.hidden) find();
      if (n) mark(k == "ArrowDown" ? (cur + 1) % n : (cur - 1 + n) % n);
    } else if (k == "Enter") {
      e.preventDefault();
      if (n) choose(res[cur < 0 ? 0 : cur]);
    } else if (k == "Escape") {
      if (!list.hidden) close(); else input.value = "";
    }
  });
  list.addEventListener("pointerdown", (e) => e.preventDefault());
  list.addEventListener("click", (e) => { const o = e.target.closest(".sugg-opt"); o && choose(res[+o.id.slice(1)]); });
  $(".search").addEventListener("focusout", (e) => { if (!e.currentTarget.contains(e.relatedTarget)) close(); });
  $(".search").addEventListener("submit", (e) => { e.preventDefault(); res.length && choose(res[0]); });

  /* ── Cart, pockets, menu, upload ───────────────────────────────────── */
  const cart = {}, cnt = $(".cart-count"), cartLink = $(".nav-cart"), file = $("#rx-file"), menuBtn = $(".nav-menu");
  function render(s) {
    const n = cart[s] || 0;
    $$(`[data-slug="${s}"] .cart-ctl`).forEach((c) => { c.dataset.qty = n; $("output", c).value = n; $("[data-inc]", c).setAttribute("aria-disabled", n >= 10); });
    const t = Object.values(cart).reduce((a, b) => a + b, 0);
    cnt.textContent = t;
    cartLink.setAttribute("aria-label", `Cart, ${t} ${t == 1 ? "item" : "items"}`);
    film && cnt.animate([{ transform: "translateY(45%)", opacity: 0 }, { transform: "none", opacity: 1 }], { duration: 220, easing: "cubic-bezier(0.23, 1, 0.32, 1)" });
  }
  const menu = (o) => { menuBtn.setAttribute("aria-expanded", o); nav.classList.toggle("menu-open", o); };
  d.addEventListener("click", (e) => {
    const t = e.target, b = t.closest("[data-add],[data-inc],[data-dec]");
    if (b) {
      if (b.getAttribute("aria-disabled") == "true") return;
      const p = b.closest("[data-slug]"), s = p.dataset.slug, c = b.closest(".cart-ctl");
      const n = (cart[s] = Math.max(0, Math.min(10, (cart[s] || 0) + (b.hasAttribute("data-dec") ? -1 : 1))));
      render(s);
      if (b.hasAttribute("data-add")) $("[data-inc]", c).focus(); else if (!n) $("[data-add]", c).focus();
      say(n ? `${p.dataset.name}: ${n} in cart` : `${p.dataset.name} removed from cart`);
      return;
    }
    const bl = t.closest(".blister-btn");
    if (bl) {
      const p = bl.closest(".pocket"), o = bl.getAttribute("aria-expanded") != "true";
      $$(".pocket--hero.is-open").forEach((x) => { x.classList.remove("is-open"); $(".blister-btn", x).setAttribute("aria-expanded", "false"); });
      p.classList.toggle("is-open", o);
      bl.setAttribute("aria-expanded", o);
      return;
    }
    const a = t.closest("[data-rx],[data-search],.menu a");
    if (a && a.closest(".menu")) menu(false);
    if (a && a.hasAttribute("data-rx")) { e.preventDefault(); file.click(); }
    else if (a && a.hasAttribute("data-search")) { e.preventDefault(); scrollTo(0, 0); input.focus({ preventScroll: true }); }
    else if (t.closest(".nav-menu")) menu(menuBtn.getAttribute("aria-expanded") != "true");
    else if (!t.closest(".menu")) menu(false);
  });
  d.addEventListener("keydown", (e) => { if (e.key == "Escape" && nav.classList.contains("menu-open")) { menu(false); menuBtn.focus(); } });
  chips.forEach((c) => c.addEventListener("click", () => {
    const on = c.getAttribute("aria-pressed") != "true";
    chips.forEach((x) => x.setAttribute("aria-pressed", x === c && on));
    str = on ? c.dataset.strength : "";
    find();
  }));
  file.addEventListener("change", () => {
    const f = file.files[0], m = f ? `${f.name} attached. You will confirm it at checkout.` : "";
    $("#rx-status").textContent = m;
    m && say(m);
  });

  /* ── Start ─────────────────────────────────────────────────────────── */
  measure();
  const go = () => {
    measure();
    if (film) drawDots();
    const m = /[?&]p=(\d):([\d.]+)/.exec(qs), A = m && acts.find((a) => NUM[a.el.id] == m[1]);
    if (A) scrollTo(0, Math.round(A.top + cl(+m[2]) * A.len));
    if (/demo=states/.test(qs)) {
      cart["sacuwin-100"] = 1; render("sacuwin-100");
      $(".pocket--hero .blister-btn").click();
      input.value = "sacu"; input.focus({ preventScroll: true }); find(); mark(1);
    }
    // the flyer and its blurred twin play only in the film; reduced motion never fetches them
    setTimeout(() => $$('img[loading="lazy"]').forEach((i) => (film || !i.closest(".flyer")) && (i.loading = "eager")), 300);
  };
  d.readyState == "complete" ? go() : addEventListener("load", go);
})();
