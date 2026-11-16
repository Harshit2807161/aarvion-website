---
version: 1
slug: "design-prototype-admin-staff-html"
primary_target: "design/prototype/admin/staff.html"
related_targets: []
---

# Surface brief: Staff

Scope: design/prototype/admin/staff.html.
Mode: **Operate**. Scanability, density, consistency and keyboard speed outrank expression. World lends type (Host Grotesk headings, Geist body, Geist Mono for ids, counts and registration numbers), palette (forest-900 rail, forest-50 hover, sand focus ring on dark), density, and one signature move: the foil perforation, a dashed rule between rail groups and between the dashboard count cells. Standard controls only (tables, selects, switches, drawer, dialog, toast).
Audience: staff. A registered pharmacist reviews prescriptions; operations staff pack and ship; an admin edits products and MRP. Desktop 1280-1600 primary, readable at 768, nothing breaks at 390.
Constraints: WCAG 2.2 AA, visible focus, keyboard-first (arrows move rows, Enter opens, Esc closes, / searches). Motion: drawer slide on transform, toast and dialog enter/exit, prefers-reduced-motion respected. All people, orders, registration numbers are labelled Example. No invented claims, licence numbers or SLAs. Chosen by me as the owner delegate on 2026-11-16.
Task: see who has which role and registration number. Read only; roles are granted by CLI and every change is audited.
States: list with active and suspended; example role-change log. No edit controls by design.
Chosen structure and why: a plain table under a one-line lock note, plus a small audit table, because the page is a reference not a workflow. Registration numbers are Geist Mono for exact transcription.
