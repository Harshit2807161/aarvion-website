// Builds design/prototype/index.html from index.src.html, injecting product
// pockets generated from data/products.json (prices derived: MRP - 20).
import fs from "node:fs";
const ROOT = "/Users/harshi/aarvion";
const SP = new URL(".", import.meta.url).pathname;
const { products } = JSON.parse(fs.readFileSync(`${ROOT}/data/products.json`, "utf8"));
const dims = JSON.parse(fs.readFileSync(`${SP}dims.json`, "utf8"));
const P = Object.fromEntries(products.map((p) => [p.slug, p]));
const rupee = (n) => "₹" + n.toLocaleString("en-IN");
const mrp = (p) => p.mrpPaise / 100;
const price = (p) => mrp(p) - 20;
const comp = (p) => p.composition.map((c) => `${c.ingredient} ${c.strength}`).join(" + ");
const compShort = (p) => p.composition.map((c) => `${c.ingredient.replace(/\s*\(.*?\)/g, "")} ${c.strength}`).join(" + ");
const packShort = (p) => p.packLabel.replace(/^Strip of /, "");
// keep a quantity with its unit ("26 mg", "14 tablets") when salt lines wrap
const nb = (s) => s.replace(/(\d) (?=[A-Za-zµ%])/g, "$1\u00a0");
const strengths = (p) => (p.variantLabel || "").replace(/^R/, "").split("/").filter(Boolean).join(" ");
const kind = (p) => (p.dosageForm === "Eye drops" ? "carton and bottle" : p.slug === "mucohelp" ? "strip and the back of its carton" : "carton and blister strip");
const alt = (p) => `${p.name} ${kind(p)}`;
const area = { cardiology: "Cardiology", diabetology: "Diabetology", ophthalmology: "Eye care", respiratory: "Respiratory" };
const icon = (id) => `<svg class="i" aria-hidden="true"><use href="#i-${id}"/></svg>`;

const img = (p, { eager = false, cls = "pocket-img" } = {}) => {
  const [w, h] = dims[p.slug];
  return `<img class="${cls}" src="assets/products/${p.slug}.webp" alt="${alt(p)}" width="${w}" height="${h}" ${eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async">`;
};
const stamp = (p, slotAttrs = "") =>
  `<p class="stamp"><s class="stamp-mrp"${slotAttrs}><span class="sr-only">Printed </span><span class="dm">MRP ${rupee(mrp(p))}</span></s><span class="stamp-price"${slotAttrs}><span class="sr-only">, our price </span><span class="dm">${rupee(price(p))}</span></span></p>`;
const cart = (p) =>
  `<div class="cart-ctl" data-qty="0"><button class="btn-add" type="button" data-add>${icon("plus")}<span>Add to cart</span></button><div class="stepper" role="group" aria-label="${p.name} in cart"><button type="button" data-dec aria-label="Remove one ${p.name}">${icon("minus")}</button><output>0</output><button type="button" data-inc aria-label="Add one more ${p.name}">${icon("plus")}</button></div></div>`;
const rx = `<abbr class="rx" title="Prescription required">Rx</abbr>`;

function pocket(mode, slug, extra = "") {
  const p = P[slug];
  const data = `data-slug="${slug}" data-name="${p.name}" data-salt="${comp(p)}" data-pack="${p.packLabel}" data-mrp="${mrp(p)}" data-price="${price(p)}" data-strength="${strengths(p)}" data-img="assets/products/${slug}.webp"`;
  if (mode === "hero") {
    const lead = slug === "sacuwin-100";
    let im = img(p, { eager: true });
    if (lead) im = im.replace("<img ", '<img data-in=".2 .205" ');
    return `<article class="pocket pocket--hero${lead ? " pocket--lead" : ""}" ${data} ${extra}><div class="pocket-in">
<div class="blister"><button class="blister-btn" type="button" aria-expanded="false" aria-label="${p.name}, ${rupee(price(p))}: show Add to cart"></button>${im}${cart(p)}</div>
<div class="pocket-body"><p class="pocket-name"><span>${p.name}</span>${rx}</p><p class="pocket-salt">${nb(compShort(p))} · ${nb(packShort(p))}</p>${stamp(p)}</div>
</div></article>`;
  }
  const h = mode === "feature" ? "h3" : "h4";
  const slot = mode === "feature" ? ' data-in=".85 .88"' : "";
  return `<article class="pocket pocket--${mode}" ${data} ${extra}><div class="pocket-in">
<div class="blister">${img(p)}</div>
<div class="pocket-body"><${h} class="pocket-name"><span>${p.name}</span>${rx}</${h}><p class="pocket-salt">${nb(comp(p))}</p><p class="pocket-pack">${nb(p.packLabel)}</p>
<div class="pocket-foot">${stamp(p, slot)}${cart(p)}</div></div>
</div></article>`;
}

const cats = {
  cardiology: { id: "cardiology", slugs: ["sacuwin-50", "sacuwin-100", "sacuwin-200", "bemptor-180", "bemptor-r40"], rise: 90 },
  ophthalmology: { id: "eye-care", slugs: ["hyloage", "sysnet-ultra", "caftop", "oloage-kt"], rise: 130 },
  diabetology: { id: "diabetology", slugs: ["vildage-m-50-500"], rise: 70 },
  respiratory: { id: "respiratory", slugs: ["mucohelp"], rise: 110 },
};
function strip(key) {
  const c = cats[key];
  const n = c.slugs.length;
  return `<section class="cat" id="${c.id}" data-act="pass" data-in="0 .42 out" style="--rise:${c.rise}px" aria-labelledby="cat-${c.id}">
<div class="cat-strip"><h3 class="cat-label" id="cat-${c.id}">${area[key]}<span>${n} ${n === 1 ? "medicine" : "medicines"}</span></h3>
<div class="cat-row" style="--n:${n}">${c.slugs.map((s) => pocket("cat", s)).join("\n")}</div></div></section>`;
}

let html = fs.readFileSync(`${SP}index.src.html`, "utf8");
html = html
  .replace(/\{\{pocket:(\w+):([\w-]+)(?::([^}]*))?\}\}/g, (_, m, s, x) => pocket(m, s, x || ""))
  .replace(/\{\{strip:(\w+)\}\}/g, (_, k) => strip(k))
  .replace(/\{\{icon:([\w-]+)\}\}/g, (_, id) => icon(id))
  .replace(/\{\{img:([\w-]+):([\w -]+)\}\}/g, (_, s, cls) => img(P[s], { cls }));
const left = html.match(/\{\{[^}]+\}\}/g);
if (left) throw new Error("unreplaced: " + left.join(", "));
fs.writeFileSync(`${ROOT}/design/prototype/index.html`, html);
console.log("built", html.length, "bytes");
