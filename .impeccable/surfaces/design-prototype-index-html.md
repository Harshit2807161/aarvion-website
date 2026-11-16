---
version: 2
slug: "design-prototype-index-html"
primary_target: "design/prototype/index.html"
related_targets: ["design/prototype/pages/*.html"]
---

# Surface brief: Home (storefront landing), v2 in store format

Scope: the public home page of the Aarvion store on desktop and mobile, plus the shared store header on every customer page. Visitor mode: **Persuade, laid out as a medicine web store**. The page leads into an Operate flow: search, add to cart, upload a prescription, check out. v1 is kept at design-prototype-index-html.v1.md.

## Owner direction, 2026-11-17 (binding; supersedes v1's thesis)
The owner reviewed v1 and wrote:
- "this looks more like a startup website than a web store to buy stuff"
- "i like your scroll animations on the how ordering works and the logo pan in at the end"
- "not so much on the first product zoom in and mrp discount marketing (20 rupees is less than 30 cents), remove that whole sequence"
- "shop by area is also good, is therapy the right word tho?"
- "things needs to be more web store like https://qtways-website.vercel.app"
- "also create hero banner etc, which keeps changing"
- "keep the product catalogue as tablets on medicine background, that is good"
- "you may also see any other famous medicine web store, i mean the overall format needs to be same, not the font styling animations etc."

**Format** follows the Indian e-pharmacy pattern seen on 1mg, PharmEasy, Apollo Pharmacy and the owner's own qtways store. Format means the section order, the store header, the banner carousel, product rails, the trust strip and the footer columns.

**World** stays Aarvion's, per DESIGN.md: fonts, colours, foil pockets, dot grain and motion craft.

Visitors already know store patterns, so use them. The ₹20 appears as a plain price fact, never as a headline.

**Audience and job:** a patient, or an adult child buying for a parent, in India, usually on a mid-range Android phone, reordering a known Aarvion medicine. They need to find the exact pack (brand and strength), see the price, understand the prescription step, and act.

**Constraints:**
- No invented claims: no ratings, reviews, customer counts, "bestseller", "trending", certifications or "licensed".
- No therapeutic claims. Category names stay descriptive.
- Win2Age-printed packs never lead a banner; Sacuwin (Aarvion-printed) does.

## Removed (owner)
- v1 Act 1: the headline over the foil strip, Sacuwin 100 zooming through the screen, and the foil fill.
- v1 Act 2: the page-sized dot-matrix "MRP ₹407" stamp, the strike, and "₹387".
- The headline "Genuine medicines, ₹20 below MRP.", and every other headline or section led by the ₹20.

## Kept (owner)
- "How ordering works" with its scroll animation (v1 Act 3), with the same craft.
- The closing logo pan-in on forest with the final call to action (v1 Act 5).
- The shop-by tiles (the bento), renamed as below, still rising from depth on scroll.
- The product catalogue as real packs and tablets in foil pockets on the foil background, with their dot-matrix stamp prices.

## Ruling: "therapy" (the owner asked)
"Therapy area" is pharma-industry vocabulary; shoppers think in terms of the condition they manage. Apollo's wording is the norm in this category, so:
- Section title: **"Shop by category"** (owner's choice, 2026-11-17, over my "Shop by health condition").
- Tile and nav names: **Heart care** (cardiology), **Diabetes care** (diabetology), **Eye care** (ophthalmology), **Respiratory care** (respiratory).

These names describe the category; they make no therapeutic claim.

## Page order (desktop 1440, mobile 390)
1. **Announcement bar.** Forest-900, one line, at most 36px tall: "Free delivery across India · Cash on delivery available · A pharmacist checks every prescription". Mobile shows only the first clause, or a slow cross-fade between the three. No marquee.
2. **Store header.** White, sticky and solid; it replaces the glass pill on customer pages.
   - Desktop row 1: AARVION logo · a wide search field "Search medicines by brand or salt" (keep the existing suggestions and strength-chip behaviour) · "Upload prescription" button · Sign in · Cart with count.
   - Desktop row 2, the category bar: Heart care · Diabetes care · Eye care · Respiratory care · All medicines.
   - Mobile: a row with the logo, sign-in and cart; a full-width search below it; category chips in a horizontal scroll row.
3. **Hero banner carousel** (the owner's "hero banner which keeps changing").
   - Four slides at content width (max 1280), with the DESIGN.md radius.
   - Desktop ratio is about 2.3:1 (about 1280 × 420). Mobile is a scroll-snap track showing a peek of the next slide.
   - Each slide is a raster of a generated scene with real pack cutouts on the right. The left side holds a live HTML heading, one line of text and one button.
   - Autoplay every 6 s, with a quiet cross-fade or slide using transform and opacity only.
     - It pauses on hover, focus-within, touch, and when the tab is hidden.
     - It never autoplays under prefers-reduced-motion.
   - Controls: dots with a progress fill, plus prev/next buttons. Keyboard and screen-reader operable: a region with aria-roledescription="carousel", slides announced as "1 of 4", and a pause control.
   - Slides:
     1. **Sacuwin.** assets/banners/store/sacuwin-scene.png with the Sacuwin 50/100/200 cutouts. "Sacuwin 50, 100 and 200" / "Sacubitril and valsartan tablets in genuine Aarvion packs, delivered free." → "Shop Sacuwin".
     2. **Eye care.** eye-scene.png with the Hyloage, Sysnet Ultra, Caftop and Oloage-KT cutouts on the pedestals. "Eye drops, delivered to your door" / "Hyloage, Sysnet Ultra, Caftop and Oloage-KT." → "Shop eye care".
     3. **Prescription.** rx-scene.png. "Upload your prescription" / "A pharmacist checks it before your order is packed." → "Upload prescription".
     4. **Delivery.** delivery-scene.png. "Free delivery anywhere in India" / "Pay online or cash on delivery." → "Browse all medicines".
   - The first slide's image is the LCP: eager, fetchpriority high, with explicit dimensions. The others load lazily.
4. **Quick actions.** Three or four cards (2×2 on mobile): Order with a prescription (upload) · Search for a medicine · Track an order · Contact us.
5. **Trust strip.** Four items, each an icon and two lines, with no numbers: Genuine medicines from Aarvion · Pharmacist-checked prescriptions · Free delivery across India · Cash on delivery.
6. **Shop by category.** The kept bento tiles with the new names, each linking to its category. Counts come from the data.
7. **Product rails.**
   - One rail per condition that has medicines: "Heart care", "Eye care", then either "Diabetes and respiratory care" or a combined "More medicines". Each rail has "View all →".
   - Cards are the kept foil pockets (tablets on the foil background). Each card shows:
     - name and strength;
     - the composition, on one line;
     - the pack ("Strip of 14 tablets" / "10 ml bottle");
     - the price with the struck MRP and a computed "% off" tag (the ₹20 shown as an ordinary store discount, never a slogan);
     - an Rx badge;
     - an Add button that becomes the quantity stepper.
   - Desktop shows 4–5 cards with arrow buttons. Mobile is a scroll-snap row with a peek.
8. **How ordering works.** The kept v1 Act 3 film: steps, the perforation fill, and the Rx sheet, order log and shipping label scaling in from depth.
9. **Questions.** The FAQ, as in v1.
10. **Close.** The kept logo pan-in act and the final call to action.
11. **Footer.**
    - Store columns: Shop by category · Help and policies · Company · Contact.
    - The legal block placeholders ("To be added").
    - A payment methods line: UPI, cards and netbanking via Razorpay; cash on delivery.

## Motion grammar
- Native scroll throughout.
- The existing engine (one passive listener, one rAF tick, transform and opacity only) now runs only Act 3 (the steps), the bento rise, the product-rail parallax and the close.
- The hero is not pinned.
- The banner carousel has its own small controller (no Swiper), uses transform and opacity only, and respects reduced motion.
- prefers-reduced-motion keeps the complete static composition.

## Finish
Unreviewed and undocumented is unfinished. This rebuild ends with:
- a fresh finish review and one fix round;
- DESIGN.md and .impeccable/design.json updated: Navigation, the hero banner carousel, product rail, trust strip, quick actions, category names, the Scroll Film section without Acts 1–2, and the Do/Don't on prices.

Every shipping raster carries its provenance.

## Direction contract
THESIS: A medicine store the visitor already knows how to use (header search, a rotating banner, quick actions, rails of packs, store footer) whose shelf is a foil blister strip and whose price tag is the pack's own dot-matrix stamp. It refuses the startup scroll-film landing and any hero led by the ₹20.
OWN-WORLD: white store chrome between a forest-900 announcement line and a forest-900 footer; forest-800 and sand-200 pills; real packs in clear domes on print-field foil strips divided by perforation slits; struck MRP over a Geist Mono dot-matrix price; dashed perforation rules; Host Grotesk headings on Geist.
STORY: find the exact pack by brand, salt or strength; see MRP, price and % off as plain store facts; understand that a pharmacist checks the prescription; add to cart or upload the prescription.
FIRST VIEWPORT: 36px announcement; sticky white header (logo, wide search with suggestions and strength chips, forest Upload prescription pill, Sign in, Cart with count) over the category bar; a 1280 × 420 banner, live heading, line and button on the left, Sacuwin packs on pedestals on the right, dots with progress and controls below; quick actions begin at the fold.
FORM: store format and Aarvion world both pinned by the owner. seed: none (pinned) "things needs to be more web store like https://qtways-website.vercel.app"; "the overall format needs to be same, not the font styling animations etc."; "keep the product catalogue as tablets on medicine background". Signature motion kept from v1: the ordering film, the category bento rise and the logo pan-in close.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
