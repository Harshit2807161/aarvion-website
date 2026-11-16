---
version: 1
slug: "design-prototype-pages-login-html"
primary_target: "design/prototype/pages/login.html"
related_targets: []
---

# Surface brief: Sign in (OTP) and the sign-in dialog

Scope: `design/prototype/pages/login.html` (the /login route) and the sign-in dialog opened from the header pill or from Checkout on every other flow page. Visitor mode: **Operate**. Shared code: `css/flows.css`, `js/flows.js`.

Task: a patient or caregiver on a mid-range Android phone gets into their account with a 6-digit code sent by SMS (+91, 10 digits starting 6–9) or email, without a password, and returns to what they were doing (checkout or account). First sign-in creates the account (name, 18+ declaration, marketing opt-in separate and off by default, per the DPDP notes in requirements §10).

States: start (Mobile/Email segmented toggle), sending, code sent (30 s resend timer, code valid 5 min), wrong code (tries left), too many tries (5; Verify is hidden, the sentence carries the live countdown "You can ask for a new one in 0:17", and a primary "Send a new code" takes Verify's place at 0:00), new account, signed in. Debug: `?state=otp-sent | otp-error | otp-locked | new-account`; dialog: `cart.html?state=login-dialog`.

Constraints: OTP field is one real input (`autocomplete="one-time-code"`, `inputmode="numeric"`) drawn as six boxes, so paste and SMS autofill work and screen readers hear one field. A pasted "+91 98765 43210" normalises to 10 digits. Demo note "Prototype: use 123456". No invented claims.

Structure chosen (owner delegated the choice; no decision round): **forest field with the intro on the left and the white work card on the right**; on phones it stacks intro → card → reasons. Considered: a centred card alone (empty on desktop, explains nothing at the moment of friction), a split screen with a photo (no real photo to use; costume), and a multi-page wizard (extra loads on 4G). The forest field is the home hero's ground, so arriving here from the home reads as one world; the card is the only work area; the three reasons say why sign-in is needed right when it costs effort. The dialog variant reuses the same component: a centred modal on desktop, a drag-to-dismiss bottom sheet on phones.

Signature move: the code boxes are pressed blister wells; error turns all six red with a short shake (none under reduced motion).
