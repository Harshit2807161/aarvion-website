---
version: 1
slug: "design-prototype-admin-prescriptions-html"
primary_target: "design/prototype/admin/prescriptions.html"
related_targets: []
---

# Surface brief: Prescription queue and review

Scope: design/prototype/admin/prescriptions.html (queue at /, review at #RX-nnnn).
Mode: **Operate**. Scanability, density, consistency and keyboard speed outrank expression. World lends type (Host Grotesk headings, Geist body, Geist Mono for ids, counts and registration numbers), palette (forest-900 rail, forest-50 hover, sand focus ring on dark), density, and one signature move: the foil perforation, a dashed rule between rail groups and between the dashboard count cells. Standard controls only (tables, selects, switches, drawer, dialog, toast).
Audience: staff. A registered pharmacist reviews prescriptions; operations staff pack and ship; an admin edits products and MRP. Desktop 1280-1600 primary, readable at 768, nothing breaks at 390.
Constraints: WCAG 2.2 AA, visible focus, keyboard-first (arrows move rows, Enter opens, Esc closes, / searches). Motion: drawer slide on transform, toast and dialog enter/exit, prefers-reduced-motion respected. All people, orders, registration numbers are labelled Example. No invented claims, licence numbers or SLAs. Chosen by me as the owner delegate on 2026-11-16.
Task: pharmacist picks the oldest waiting Rx, compares the file with the order items, then approves (doctor name, doctor reg. no., Rx date, valid-until = date + 6 months, pharmacist reg. no. from profile) or rejects (reason + customer note), after a confirmation step. Audit line "Viewed by ... at ..." is written on open.
States: queue by status filter (awaiting default, approved, rejected, all) with search and empty result; review awaiting (approve and reject tabs, validation errors); decided (read-only summary); PDF in sandboxed frame; non-pharmacist (form fieldset disabled with lock note); confirmation dialog. Debug: ?state=rx-review-open, rx-reject, rx-confirm.
Chosen structure and why: queue is a full-width keyboard table (oldest first, no sort headers because order is the rule). Review replaces the queue in place via the hash, so Back restores the row focus. Review is two columns: sticky file viewer left (the thing being checked stays in view while the form scrolls), order items above the decision on the right so every field of the check sits within one eye sweep. Approve and reject are tabs, not two always-open forms, so the pharmacist cannot half-fill both. Decision uses a native dialog because it is a legal, irreversible act that earns protected focus.
