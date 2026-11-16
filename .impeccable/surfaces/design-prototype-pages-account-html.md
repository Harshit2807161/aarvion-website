---
version: 1
slug: "design-prototype-pages-account-html"
primary_target: "design/prototype/pages/account.html"
related_targets: []
---

# Surface brief: Account

Scope: `design/prototype/pages/account.html` (the /account route). Visitor mode: **Operate**. Requires sign-in.

Task: keep the details an order needs in order: profile (name, verified mobile and email; add or change a channel only through an OTP), addresses (up to 10, one default), prescriptions (under review / approved until a date / rejected with the reason / expired; upload a new one), orders (open one), privacy (marketing messages off by default, download my data, request deletion with a confirmation dialog).

States: each tab; inline OTP for a new email or mobile; address add/edit/remove (Undo) / set default; prescription upload with validation; export requested; deletion requested. Debug: `?state=account-profile | account-addresses | account-prescriptions | account-orders | account-privacy`.

Constraints: all data is example data; the "Example account" tag sits in the subline after the signed-in number, never above the H1. Retention wording stays honest ("some records, such as invoices, may have to be kept for as long as the law requires").

Structure chosen: **vertical tabs on the left with the panel on the right; on phones the tabs become a horizontal scroll of pills under the band**. Considered: one long page with all five sections (too long on a phone, the Rx list buries Privacy), and a hub of five tiles that each open a page (an extra tap and load per task). ARIA tabs with arrow keys, Home/End, and the hash kept in sync (`account.html#prescriptions` is where the header's Upload Rx pill lands).
