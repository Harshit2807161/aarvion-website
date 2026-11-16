---
version: 1
slug: "design-prototype-pages-cart-html"
primary_target: "design/prototype/pages/cart.html"
related_targets: []
---

# Surface brief: Cart page and cart drawer

Scope: `design/prototype/pages/cart.html` (the /cart route) and the cart drawer opened by the header cart pill on every flow page. Visitor mode: **Operate**.

Task: check the exact medicines (brand + strength, composition, pack), change quantities (max 10 per product, 20 packs per order), see the price promise (struck MRP, price = MRP − ₹20), understand that every item needs a prescription, and go to checkout.

States: filled; empty; quantity at max; order at the 20-pack limit; removed with Undo toast; seeded prototype cart (labelled "Prototype", with "Empty the cart"); drawer open; signed out → Checkout opens the sign-in dialog. Debug: `?state=cart-empty`, `?state=login-dialog`, drawer via `order.html?state=cart-drawer-open`.

Constraints: every price is computed in JS from the products.json MRPs (paise) minus ₹20; summary shows MRP total, Aarvion discount (₹20 × packs), Delivery Free, Total payable, "Inclusive of all taxes". The cart lives in localStorage (`aarvion.cart.v1`, try/catch, memory fallback; `?state=` never writes it). The home page keeps its own in-memory cart until it adopts this key.

Structure chosen: **list + sticky receipt** (category standard; known patterns earn their place on an Operate surface). Considered: single column with the summary at the end (hides the total on desktop), and lines as pockets of a foil strip (a costume of the home's Persuade move on a working screen; rejected). The Rx group heading carries the prescription note. On phones a dock with the total and Checkout appears once the receipt's button scrolls away. The receipt is printed on the shipping-label paper (sand-50) with a perforated rule above Total payable, and Total payable is set in the pack's dot-matrix stamp (the order slip's lettering). Rupee grouping uses Geist's proportional comma inside the mono figures so "₹1,179" never opens a gap. When a quantity changes the total re-stamps once (WAAPI, scale 1.12 → 1 with opacity, 220 ms, strong ease-out, restartable, opacity-only under reduced motion). The empty cart is an empty label-paper tile (sand-50, dashed sand rule) holding a dot-matrix "0": no faked bevel until the home's foil-pocket raster ships.

Drawer: right-side sheet on desktop, bottom sheet with a drag handle on phones; transform-only transitions (interruptible), ESC closes, focus trapped, background inert, reduced motion falls back to a fade.
