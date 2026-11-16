/* Aarvion store chrome, on every customer page: the header search (a combobox with suggestions
   and strength chips), the announcement line's slow cross-fade on phones, the header's shadow once
   it sticks, and the account pill on the home page. Reads window.AARVION_CATALOGUE (js/catalogue.js,
   generated from data/products.json). No libraries. */
(() => {
  const d = document, $ = (s, c = d) => c.querySelector(s), $$ = (s, c = d) => [...c.querySelectorAll(s)];
  const reduce = matchMedia("(prefers-reduced-motion: reduce)");
  const say = (t) => { const l = $("#live"); if (!l) return; l.textContent = ""; setTimeout(() => (l.textContent = t), 40); };
  const head = $("[data-store-head]"), ann = $("[data-announce]");

  /* ── The header's shadow appears once it sticks (no scroll listener) ─ */
  if (ann && head && "IntersectionObserver" in window) {
    const stuck = [head, $(".catbar")].filter(Boolean);
    new IntersectionObserver(([e]) => stuck.forEach((t) => t.classList.toggle("is-stuck", !e.isIntersecting))).observe(ann);
  }

  /* ── Announcement: phones show one notice at a time, cross-fading every 5s ── */
  if (ann) {
    const items = $$(".ann", ann), mq = matchMedia("(max-width: 720px)");
    let i = 0, t = 0;
    const run = () => {
      clearInterval(t);
      items.forEach((x) => x.classList.remove("is-on"));
      ann.classList.remove("is-rotating");
      if (!mq.matches || reduce.matches) return;
      ann.classList.add("is-rotating");
      items[(i = 0)].classList.add("is-on");
      t = setInterval(() => {
        if (d.hidden) return;
        items[i].classList.remove("is-on");
        i = (i + 1) % items.length;
        items[i].classList.add("is-on");
      }, 5000);
    };
    mq.addEventListener("change", run);
    reduce.addEventListener("change", run);
    run();
  }

  /* ── Account pill on the home page (customer pages render it in flows.js) ── */
  const acct = $("[data-acct]");
  if (acct && !d.body.dataset.page) {
    let u = null;
    try { u = JSON.parse(localStorage.getItem("aarvion.session.v1") || "null"); } catch (e) { /* storage blocked */ }
    if (u) {
      acct.href = "pages/account.html";
      acct.dataset.signedIn = "";
      $(".acct-dot", acct).textContent = (u.name || "A").trim().charAt(0).toUpperCase();
      $(".acct-label", acct).textContent = "Account";
      acct.setAttribute("aria-label", `Your account${u.name ? ", " + u.name : ""}`);
    }
  }

  /* ── Search: brand or salt, filtered by strength ───────────────────── */
  const form = head && $(".search", head);
  if (!form) return;
  const input = $("#q", form), panel = $(".sugg-panel", form), list = $("#sugg", form), hint = $(".sugg-hint", form), chips = $$(".chip", form);
  const home = head.dataset.home; // "" on the home page, "../index.html" on customer pages
  const root = home ? "../" : "";
  const items = (window.AARVION_CATALOGUE || []).map((p) => ({ ...p, key: (p.name + " " + p.salt).toLowerCase() }));
  let res = [], cur = -1, str = "";
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => "&#" + c.charCodeAt(0) + ";");
  const hl = (s, ws) => ws.reduce((h, w) => h.replace(new RegExp("(" + w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ")(?![^<]*>)", "ig"), "<mark>$1</mark>"), esc(s));
  const inr = (n) => "₹" + n.toLocaleString("en-IN");

  function find() {
    const v = input.value.trim().toLowerCase(), ws = v ? v.split(/\s+/) : [], q = !!(v || str);
    res = q ? items.filter((it) => ws.every((w) => it.key.includes(w)) && (!str || it.strength.split(" ").includes(str))) : [];
    cur = -1;
    panel.hidden = false;
    hint.hidden = q;
    list.hidden = !q;
    input.setAttribute("aria-expanded", q);
    input.removeAttribute("aria-activedescendant");
    list.innerHTML = !q ? "" : res.length
      ? res.map((it, i) => `<li role="option" id="o${i}" class="sugg-opt" aria-selected="false"><img src="${root}assets/products/${it.slug}.webp" alt="" width="44" height="44" decoding="async"><span class="sugg-main"><span class="sugg-name">${hl(it.name, ws)}</span><span class="sugg-meta">${hl(it.salt, ws)} · ${esc(it.pack)}</span></span><span class="sugg-price"><s><span class="sr-only">Printed </span>MRP ${inr(it.mrp)}</s><b><span class="sr-only">, our price </span>${inr(it.price)}</b></span></li>`).join("")
      : `<li class="sugg-empty" role="presentation">No medicine matches. Try a brand such as Sacuwin or a salt such as Valsartan.</li>`;
    if (q) say(res.length ? `${res.length} ${res.length == 1 ? "medicine" : "medicines"} found` : "No medicine matches");
  }
  function mark(i) {
    cur = i;
    $$(".sugg-opt", list).forEach((o, k) => o.setAttribute("aria-selected", k === i));
    if (i >= 0) { input.setAttribute("aria-activedescendant", "o" + i); $("#o" + i).scrollIntoView({ block: "nearest" }); }
  }
  function close() {
    panel.hidden = true; list.hidden = true;
    input.setAttribute("aria-expanded", "false");
    input.removeAttribute("aria-activedescendant");
    cur = -1;
  }
  // On the home page the pocket is on the shelf: bring it into view and put focus on its cart
  // control. Elsewhere, go to it on the home page.
  function reveal(el) {
    $$(".is-found").forEach((x) => x.classList.remove("is-found"));
    el.scrollIntoView({ block: "center", inline: "center" });
    el.classList.add("is-found");
    const c = $(".cart-ctl", el);
    c && $(c.dataset.qty == "0" ? "[data-add]" : "[data-inc]", c).focus({ preventScroll: true });
  }
  function choose(it) {
    close();
    const el = d.getElementById("p-" + it.slug);
    if (el) reveal(el);
    else location.href = (home || "index.html") + "#p-" + it.slug;
  }
  input.addEventListener("input", find);
  input.addEventListener("focus", find);
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
      if (!panel.hidden) close(); else input.value = "";
    }
  });
  list.addEventListener("pointerdown", (e) => e.preventDefault());
  list.addEventListener("click", (e) => { const o = e.target.closest(".sugg-opt"); o && choose(res[+o.id.slice(1)]); });
  form.addEventListener("focusout", (e) => { if (!form.contains(e.relatedTarget)) close(); });
  form.addEventListener("submit", (e) => { e.preventDefault(); res.length && choose(res[0]); });
  chips.forEach((c) => c.addEventListener("click", () => {
    const on = c.getAttribute("aria-pressed") != "true";
    chips.forEach((x) => x.setAttribute("aria-pressed", x === c && on));
    str = on ? c.dataset.strength : "";
    find();
  }));
  // "Search for a medicine" anywhere on the page puts the caret in the header search
  d.addEventListener("click", (e) => {
    const a = e.target.closest("[data-search]");
    if (!a) return;
    e.preventDefault();
    input.focus();
  });
  // Arriving from another page's search: show the chosen pocket
  const m = /^#p-([\w-]+)$/.exec(location.hash), target = m && d.getElementById("p-" + m[1]);
  if (target) addEventListener("load", () => setTimeout(() => reveal(target), 60));
})();
