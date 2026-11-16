// Builds design/prototype/index.html from index.src.html: product rails, category counts and the
// store chrome come from data/products.json and src/chrome.mjs. Prices are derived, never stored:
// price = MRP − ₹20, and % off = round(2000 / mrpPaise × 100).
// Also writes js/catalogue.js (the header search's list on every page) and refreshes the store
// chrome inside the <!-- chrome:head --> / <!-- chrome:foot --> markers of pages/*.html.
import fs from "node:fs";
import { chromeHead, chromeFoot } from "./chrome.mjs";
const ROOT = "/Users/harshi/aarvion";
const PROTO = `${ROOT}/design/prototype`;
const SP = new URL(".", import.meta.url).pathname;
const { products } = JSON.parse(fs.readFileSync(`${ROOT}/data/products.json`, "utf8"));
const dims = JSON.parse(fs.readFileSync(`${SP}dims.json`, "utf8"));
const P = Object.fromEntries(products.map((p) => [p.slug, p]));

const OFF = 2000; // paise
const rupee = (paise) => "₹" + Math.round(paise / 100).toLocaleString("en-IN").replace(/,/g, '<span class="cm">,</span>');
const price = (p) => p.mrpPaise - OFF;
// a discount tag never rounds up: floor, so it never claims more than the ₹20 off the MRP
const pctOff = (p) => Math.floor((OFF / p.mrpPaise) * 100);
const comp = (p) => p.composition.map((c) => `${c.ingredient} ${c.strength}`).join(" + ");
// The card shows the actives only (preservatives dropped, the salt form "(as sodium)" too), each
// strength kept whole on one line so a wrap or the two-line clamp can never cut it. The full
// composition stays in the title and for assistive tech.
const actives = (p) => p.composition.filter((c) => !/preservative/i.test(c.ingredient))
  .map((c) => `${c.ingredient.replace(/\s*\(.*?\)/g, "")} <span class="str">${c.strength.replace(/ /g, "\u00a0")}</span>`).join(" + ");
const pack = (p) => (p.dosageForm === "Eye drops" ? `${p.packLabel} bottle` : p.packLabel);
// keep a quantity with its unit ("26 mg", "14 tablets") when a line wraps
const nb = (s) => s.replace(/(\d) (?=[A-Za-zµ%])/g, "$1 ");
const strengths = (p) => (p.variantLabel || "").replace(/^R/, "").split("/").filter(Boolean).join(" ");
const kind = (p) => (p.dosageForm === "Eye drops" ? "carton and bottle" : p.slug === "mucohelp" ? "strip and the back of its carton" : "carton and blister strip");
const icon = (id) => `<svg class="i" aria-hidden="true"><use href="#i-${id}"/></svg>`;
const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;

// Categories: shopper-facing names (owner ruling, brief v2) over the data's therapy areas.
const AREA = {
  cardiology: "Heart care",
  diabetology: "Diabetes care",
  ophthalmology: "Eye care",
  respiratory: "Respiratory care",
};
const inArea = (a) => products.filter((p) => p.active && p.category === a).sort((x, y) => x.sortOrder - y.sortOrder);
// Rails: Heart care, Eye care, then diabetes and respiratory together (one medicine each).
const RAILS = [
  { id: "heart-care", title: "Heart care", areas: ["cardiology"], order: ["sacuwin-50", "sacuwin-100", "sacuwin-200", "bemptor-180", "bemptor-r40"], rise: 80 },
  { id: "eye-care", title: "Eye care", areas: ["ophthalmology"], rise: 110 },
  { id: "diabetes-care", title: "Diabetes and respiratory care", areas: ["diabetology", "respiratory"], also: "respiratory-care", rise: 90, aside: true },
];

const img = (p, { cls = "pocket-img", lazy = true } = {}) => {
  const [w, h] = dims[p.slug];
  return `<img class="${cls}" src="assets/products/${p.slug}.webp" alt="${p.name} ${kind(p)}" width="${w}" height="${h}" ${lazy ? 'loading="lazy" ' : ""}decoding="async">`;
};
const stamp = (p) =>
  `<p class="stamp"><span class="stamp-top"><s class="stamp-mrp"><span class="sr-only">Printed </span><span class="dm">MRP ${rupee(p.mrpPaise)}</span></s><span class="off"><span class="sr-only">, </span>${pctOff(p)}% off</span></span><span class="stamp-price"><span class="sr-only">, our price </span><span class="dm">${rupee(price(p))}</span></span></p>`;
const cart = (p) =>
  `<div class="cart-ctl" data-qty="0"><button class="btn-add" type="button" data-add aria-label="Add ${p.name} to cart">${icon("plus")}<span>Add to cart</span></button><div class="stepper" role="group" aria-label="${p.name} in cart"><button type="button" data-dec aria-label="Remove one ${p.name}">${icon("minus")}</button><output aria-live="polite">0</output><button type="button" data-inc aria-label="Add one more ${p.name}">${icon("plus")}</button></div></div>`;
const rx = `<abbr class="rx" title="Prescription required">Rx</abbr>`;

function pocket(p) {
  return `<li class="pocket" id="p-${p.slug}" data-slug="${p.slug}" data-name="${p.name}"><div class="pocket-in">
<div class="blister">${img(p)}</div>
<div class="pocket-body"><h3 class="pocket-name"><span>${p.name}</span>${rx}</h3><p class="pocket-salt" title="${comp(p)}"><span aria-hidden="true">${actives(p)}</span><span class="sr-only">${comp(p)}</span></p><p class="pocket-pack">${nb(pack(p))}</p>
<div class="pocket-foot">${stamp(p)}${cart(p)}</div></div>
</div></li>`;
}

function rail(r) {
  const list = r.order ? r.order.map((s) => P[s]) : r.areas.flatMap(inArea);
  const n = list.length;
  return `<section class="rail" id="${r.id}" data-act="pass" data-in="0 .4 out" style="--rise:${r.rise}px" aria-labelledby="rail-${r.id}">${r.also ? `<span class="anchor" id="${r.also}"></span>` : ""}
<div class="rail-head"><h2 class="h-section" id="rail-${r.id}">${r.title}</h2><p class="rail-count">${plural(n, "medicine")}</p>
<button class="rail-all" type="button" aria-expanded="false" aria-controls="row-${r.id}" hidden><span class="rail-all-t" data-more="View all ${n}" data-less="Show fewer">View all ${n}</span><span class="sr-only"> ${r.title.toLowerCase()} medicines</span>${icon("chev")}</button>
<div class="rail-arrows" hidden><button class="rail-btn" type="button" data-rail="-1" aria-label="Scroll ${r.title} back">${icon("back")}</button><button class="rail-btn" type="button" data-rail="1" aria-label="Scroll ${r.title} forward">${icon("arrow")}</button></div></div>
<div class="rail-body"><div class="rail-strip"><ul class="rail-row" id="row-${r.id}" style="--n:${n}">
${list.map(pocket).join("\n")}
</ul></div>${r.aside ? ASIDE : ""}</div></section>`;
}

// beside the short last strip: where to go when the medicine is not on the shelf yet
const ASIDE = `<aside class="rail-aside" aria-labelledby="more-title"><h3 id="more-title">Looking for another Aarvion medicine?</h3><p>More of Aarvion’s medicines are being added to the store. Search by brand or salt, or get in touch.</p><div class="rail-aside-act"><a class="btn btn-forest" href="#q" data-search>${icon("search")}<span>Search medicines</span></a><a class="btn btn-quiet" href="#contact">Contact us</a></div></aside>`;

const count = (a) => plural(inArea(a).length, "medicine");

// ── Home ───────────────────────────────────────────────────────────────────
let html = fs.readFileSync(`${SP}index.src.html`, "utf8");
html = html
  .replace("{{chrome:head}}", chromeHead({ home: true }))
  .replace("{{chrome:foot}}", chromeFoot({ home: true }))
  .replace("{{rails}}", () => RAILS.map(rail).join("\n"))
  .replace(/\{\{count:(\w+)\}\}/g, (_, a) => count(a))
  .replace(/\{\{total\}\}/g, () => String(products.filter((p) => p.active).length))
  .replace(/\{\{icon:([\w-]+)\}\}/g, (_, id) => icon(id))
  .replace(/\{\{img:([\w-]+):([\w -]+)\}\}/g, (_, s, cls) => img(P[s], { cls }));
const left = html.match(/\{\{[^}]+\}\}/g);
if (left) throw new Error("unreplaced: " + left.join(", "));
fs.writeFileSync(`${PROTO}/index.html`, html);
console.log("built index.html", html.length, "bytes");

// ── Catalogue for the header search (every page) ───────────────────────────
const cat = products.filter((p) => p.active).sort((a, b) => a.sortOrder - b.sortOrder).map((p) => ({
  slug: p.slug, name: p.name, salt: comp(p), pack: pack(p), mrp: p.mrpPaise / 100, price: price(p) / 100,
  off: pctOff(p), strength: strengths(p), area: AREA[p.category],
}));
fs.writeFileSync(`${PROTO}/js/catalogue.js`, `/* Generated by src/build.mjs from data/products.json. Price = MRP − ₹20. Do not edit. */\nwindow.AARVION_CATALOGUE = ${JSON.stringify(cat)};\n`);
console.log("wrote js/catalogue.js", cat.length, "products");

// ── Customer pages: refresh the chrome between markers ─────────────────────
for (const page of ["login", "cart", "checkout", "order", "account"]) {
  const f = `${PROTO}/pages/${page}.html`;
  let s = fs.readFileSync(f, "utf8");
  const reduced = page === "checkout";
  const proto = (s.match(/<nav class="proto"[\s\S]*?<\/nav>/) || [""])[0];
  const head = `<!-- chrome:head -->\n${chromeHead({ reduced })}\n<!-- /chrome:head -->`;
  const foot = `<!-- chrome:foot -->\n${chromeFoot({ proto })}\n<!-- /chrome:foot -->`;
  if (s.includes("<!-- chrome:head -->")) s = s.replace(/<!-- chrome:head -->[\s\S]*?<!-- \/chrome:head -->/, () => head);
  else s = s.replace(/<header class="nav-wrap">[\s\S]*?<\/header>/, () => head);
  if (s.includes("<!-- chrome:foot -->")) s = s.replace(/<!-- chrome:foot -->[\s\S]*?<!-- \/chrome:foot -->/, () => foot);
  else s = s.replace(/<footer class="foot"[\s\S]*?<\/footer>/, () => foot);
  if (!s.includes("css/store.css")) s = s.replace('<link rel="stylesheet" href="../css/flows.css">', '<link rel="stylesheet" href="../css/flows.css">\n<link rel="stylesheet" href="../css/store.css">');
  if (!s.includes("js/store.js")) s = s.replace('<script src="../js/flows.js" defer></script>', '<script src="../js/catalogue.js" defer></script>\n<script src="../js/store.js" defer></script>\n<script src="../js/flows.js" defer></script>');
  fs.writeFileSync(f, s);
  console.log("chrome →", `pages/${page}.html`, reduced ? "(reduced header)" : "");
}
