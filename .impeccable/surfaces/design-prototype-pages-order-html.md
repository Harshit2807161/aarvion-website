---
version: 1
slug: "design-prototype-pages-order-html"
primary_target: "design/prototype/pages/order.html"
related_targets: []
---

# Surface brief: Order confirmation and order detail

Scope: `design/prototype/pages/order.html` (the /order/[number] route); the same page is the confirmation after checkout (`?placed=1`) and the detail page opened from Orders. Visitor mode: **Operate**.

Task: know the order went through and what happens next (a pharmacist reviews the prescription), follow its status, and act: cancel with a reason (until packed), order the same items again, download the invoice (after delivery).

States: placed / Rx under review; shipped (Example Courier, tracking number and link); delivered (invoice enabled); on hold (Rx not approved: reason, upload a new one, or cancel for a full refund); cancelled (refund 5–7 working days, per the accepted rule). Debug: `?state=order-placed | order-shipped | order-delivered | order-on-hold | order-cancelled`.

Constraints: signed-in only (a signed-out visit goes to login with `next=order.html…`). A prescription that is not yet approved never carries a tick; cancelled-before-approval reviews show a clock. Each prescription file has one status everywhere: the on-hold example uses its own record, prescription-old.jpg, dated 2 Mar 2026 and rejected for being more than 6 months old, listed identically in Account and Checkout. Order number format AAR-YYMM-NNNNN (example AAR-2611-00042); example orders, courier and tracking are labelled "Example". No delivery-time promises. Returns line uses the accepted rule (damaged, wrong or expired, within 48 hours).

Structure chosen: **status as the headline itself (no line above the H1; the status tag and the timeline's current step carry the state) + order-number slip in the band; timeline and items on the left; receipt, address, prescription and actions on the right** (stacked status-first on phones). Considered: a separate thank-you page plus a detail page (two routes for one object), and a receipt-first layout (the status, not the money, is what a patient checks). Signature move: the order number is printed in the pack's dot-matrix inkjet on a shipping-label slip, stamped in once on confirmation; the timeline rail is the perforation, solid as steps complete.
