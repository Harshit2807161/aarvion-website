---
version: 1
slug: "design-prototype-admin-products-html"
primary_target: "design/prototype/admin/products.html"
related_targets: []
---

# Surface brief: Products

Scope: design/prototype/admin/products.html with the edit drawer.
Mode: **Operate**. Scanability, density, consistency and keyboard speed outrank expression. World lends type (Host Grotesk headings, Geist body, Geist Mono for ids, counts and registration numbers), palette (forest-900 rail, forest-50 hover, sand focus ring on dark), density, and one signature move: the foil perforation, a dashed rule between rail groups and between the dashboard count cells. Standard controls only (tables, selects, switches, drawer, dialog, toast).
Audience: staff. A registered pharmacist reviews prescriptions; operations staff pack and ship; an admin edits products and MRP. Desktop 1280-1600 primary, readable at 768, nothing breaks at 390.
Constraints: WCAG 2.2 AA, visible focus, keyboard-first (arrows move rows, Enter opens, Esc closes, / searches). Motion: drawer slide on transform, toast and dialog enter/exit, prefers-reduced-motion respected. All people, orders, registration numbers are labelled Example. No invented claims, licence numbers or SLAs. Chosen by me as the owner delegate on 2026-11-16.
Task: admin finds a product, flips active, edits name, composition rows, pack, MRP (live "Selling price = MRP - Rs 20" preview, MRP >= Rs 21), schedule, Rx required, therapy area, and replaces the photo. Filter "Needs photo swap" shows imageSource win2age.
States: table with filters and empty result; active switch (role-gated); edit drawer valid, invalid MRP (?state=product-edit-invalid-mrp), photo preview after upload, dirty-close confirmation, add-product mode, read-only for non-admin.
Chosen structure and why: table with thumbnail, composition and both prices side by side so a wrong MRP is visible at a glance; edit in a wide drawer so the table context stays. Price is a derived preview, never an input. Schedule H and H1 lock Rx required on because the business rule says every scheduled product needs a prescription.
