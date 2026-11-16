---
version: 1
slug: "design-prototype-pages-checkout-html"
primary_target: "design/prototype/pages/checkout.html"
related_targets: []
---

# Surface brief: Checkout

Scope: `design/prototype/pages/checkout.html` (the /checkout route). Visitor mode: **Operate**. Requires sign-in (signed-out visitors are sent to login with `next=checkout.html`).

Task: in four steps on one page, choose a delivery address, attach a prescription, choose how to pay, review, and place the order.
1. Address: saved-address radio cards (default first) or a new address (Indian states and union territories select, 6-digit pincode that cannot start with 0).
2. Prescription: Saved (status chips; rejected and expired are disabled with the reason) / Upload new (drag-drop or file picker, camera on touch devices; JPG, PNG, WebP or PDF up to 8 MB; patient name; "valid prescription from a registered doctor" declaration) / From a past order (if still valid).
3. Payment: Razorpay (UPI, cards, netbanking) or cash on delivery, disabled above ₹5,000 with the reason and the order total.
4. Review, then place order (loading state), then the order confirmation.

States: each step current/done/todo; address errors with a focusable error summary and inline errors on blur; upload errors (type, size, missing file); COD unavailable; placing. Debug: `?state=checkout | checkout-errors | checkout-step-2 | checkout-upload | checkout-step-3 | cod-disabled | checkout-review`.

Structure chosen: **one-page stepped accordion with the progress rail in the forest band and a sticky receipt**. Considered: a wizard that shows one step at a time (loses the earlier answers, more back-and-forth), and one long form (the prescription step would dominate and errors scatter). Completed steps collapse to a one-line summary with Change. At Review the done-step shells are hidden and their summaries live only in the review list; each Change there reopens its step, and the band rail still shows every step as done. Status tags size to their content (`fit-content`), so long Rx validity tags wrap inside their card on a phone. On phones the receipt becomes a collapsed "Order summary ₹…" disclosure above the steps. The progress rail uses the home's perforation: dashed for steps to come, solid sand once done.
