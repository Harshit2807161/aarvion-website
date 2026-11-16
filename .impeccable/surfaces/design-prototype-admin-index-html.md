---
version: 1
slug: "design-prototype-admin-index-html"
primary_target: "design/prototype/admin/index.html"
related_targets: []
---

# Surface brief: Admin dashboard

Scope: design/prototype/admin/index.html, the staff landing screen.
Mode: **Operate**. Scanability, density, consistency and keyboard speed outrank expression. World lends type (Host Grotesk headings, Geist body, Geist Mono for ids, counts and registration numbers), palette (forest-900 rail, forest-50 hover, sand focus ring on dark), density, and one signature move: the foil perforation, a dashed rule between rail groups and between the dashboard count cells. Standard controls only (tables, selects, switches, drawer, dialog, toast).
Audience: staff. A registered pharmacist reviews prescriptions; operations staff pack and ship; an admin edits products and MRP. Desktop 1280-1600 primary, readable at 768, nothing breaks at 390.
Constraints: WCAG 2.2 AA, visible focus, keyboard-first (arrows move rows, Enter opens, Esc closes, / searches). Motion: drawer slide on transform, toast and dialog enter/exit, prefers-reduced-motion respected. All people, orders, registration numbers are labelled Example. No invented claims, licence numbers or SLAs. Chosen by me as the owner delegate on 2026-11-16.
Task: see what needs doing now and jump into it. Counts for Rx awaiting review, orders to pack, orders to ship, today's orders; a labelled example activity feed; the idle-timeout warning pattern.
States: counts with data; empty queue copy ("Queue is clear"); idle warning toast (?state=idle-warning, sticky, live countdown, Stay signed in / Sign out now); signed-out overlay.
Chosen structure and why: left rail on forest-900 (white logo, five nav items, live badges) because staff switch between queues all day and a persistent rail is the category norm. Main = one strip of four count links (each a deep link to its queue, with oldest-age context, separated by the perforation) above a two-column body: the two shortest "work next" tables on the left, the activity feed and session panel on the right. Rejected: a card grid of equal KPI tiles (hero-metric template) and a chart (no honest history exists to plot).
