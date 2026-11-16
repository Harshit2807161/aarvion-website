---
version: 1
slug: "design-prototype-index-html"
primary_target: "design/prototype/index.html"
related_targets: []
---

# Surface brief: Home (storefront landing)

Scope: the public home page of the Aarvion store, desktop and mobile. Visitor mode: **Persuade**. It is the entry to an Operate flow (search, add to cart, Rx, checkout).

Audience and job: a patient or adult child in India, usually on a mid-range Android phone, reordering a known Aarvion medicine. They need to find the exact pack (brand + strength), trust the price (MRP − ₹20), understand the prescription step, and act.

Action: search or add to cart from the first viewport; "Upload prescription" as the primary call to action.
Proof: real pack photos; the real printed MRPs with ₹20 off; free delivery; a pharmacist checks every Rx.
Constraints: no invented claims (no ratings, counts, certifications, "licensed"); no therapeutic claims. Win2Age-printed packs stay out of the hero.

Chosen direction: "The Strip" (Impeccable's pick card), chosen by me as the owner's delegate on 2026-11-16, raised with The Leaflet's working-search and fact-row discipline. Comp reference: .impeccable/mocks/decision/pick.png (decision comp, the critique reference; the build path is code-led because the owner is away and comp-led plate approval needs the owner).

## Direction contract
THESIS: The price promise is shown where Indians already check a price, the dot-matrix MRP stamp on a medicine pack. The real packs sit in one continuous foil strip, each MRP struck and re-stamped ₹20 lower. It refuses the e-pharmacy banner carousel and the centred headline over a row of equal cards: the strip is one foil object, and its pockets are identical units differing only in value.
OWN-WORLD:
- Deep forest field #1F3D2B with a fine inkjet dot grain, fading through soft white fog into a clean white page.
- Silver-foil blister material with dashed perforations.
- Sand #E8DCC4 for the primary pill on dark ground.
- Host Grotesk display (tight, 600–700), Geist body, Geist Mono for stamp data.
- Glass pill nav; pill controls.
- Colour lives on fields and rules; text stays neutral.
STORY:
- The visitor sees their exact medicine and its two prices at once and believes the ₹20 is real (printed MRP, struck).
- They learn a pharmacist checks the Rx and delivery is free.
- They search, add to cart, or upload a prescription.
FIRST VIEWPORT: (desktop 1440 × 900)
- A glass pill nav floats near the top: logo, 4 therapy links, Upload Rx, Cart · 1.
- A centred two-line headline "Genuine medicines, ₹20 below MRP." at about 80px, white.
- One subline.
- A working search pill (brand or salt, with strength chips) beside a sand "Upload prescription" pill.
- From the fog at the lower third rises one foil strip of 4 pockets: Sacuwin 50 / 100 / 200 as real pack cutouts, each with a dot-matrix stamp (MRP struck, new price), plus a 4th pocket "All 11 medicines →".
- On mobile the strip scrolls horizontally with snap.
- Signature interaction: on load the stamps print in once (dots resolve, strike draws across the MRP, the new price stamps). Pressing a pocket depresses the foil and reveals Add to cart.
FORM: The Strip, my grounded list #1 (Impeccable's pick card; the roll assigned #4, The Leaflet). seed:26efee81f47ef0ec
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
