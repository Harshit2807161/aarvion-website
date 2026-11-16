---
version: 1
slug: "design-prototype-admin-orders-html"
primary_target: "design/prototype/admin/orders.html"
related_targets: []
---

# Surface brief: Orders

Scope: design/prototype/admin/orders.html with the order detail drawer.
Mode: **Operate**. Scanability, density, consistency and keyboard speed outrank expression. World lends type (Host Grotesk headings, Geist body, Geist Mono for ids, counts and registration numbers), palette (forest-900 rail, forest-50 hover, sand focus ring on dark), density, and one signature move: the foil perforation, a dashed rule between rail groups and between the dashboard count cells. Standard controls only (tables, selects, switches, drawer, dialog, toast).
Audience: staff. A registered pharmacist reviews prescriptions; operations staff pack and ship; an admin edits products and MRP. Desktop 1280-1600 primary, readable at 768, nothing breaks at 390.
Constraints: WCAG 2.2 AA, visible focus, keyboard-first (arrows move rows, Enter opens, Esc closes, / searches). Motion: drawer slide on transform, toast and dialog enter/exit, prefers-reduced-motion respected. All people, orders, registration numbers are labelled Example. No invented claims, licence numbers or SLAs. Chosen by me as the owner delegate on 2026-11-16.
Task: find an order, see where it is and do only the next allowed step. State machine: confirmed needs Rx approved and (paid or COD); shipped needs courier, AWB and tracking URL; cancel only until packed; COD collected after shipping; refund after a prepaid cancel or rejection.
States: table with status segments (counts), payment and Rx selects, search, empty result; drawer for each status (placed blocked on Rx, on hold, confirmed, packed with ship form, shipped, delivered, cancelled, refunded); role lock for pharmacist; cancel and refund confirmation. Debug: ?state=order-drawer-ship. Deep link #AAR-YYMM-NNNNN.
Chosen structure and why: one dense table with the eight columns the brief names and a right-hand drawer for detail, so the list never loses its place (Esc returns focus to the row). The drawer leads with a "Next step" box listing only allowed actions plus plain reasons for blocked ones, then the timeline, items, payment and Rx. Drawer over a separate detail page because ops work through many orders in a row.
