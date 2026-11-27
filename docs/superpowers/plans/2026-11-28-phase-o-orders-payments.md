# Phase O (Orders and Payments) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a signed-in customer turn their server cart into an order through a four-step checkout (address, prescription, payment, review), pay cash on delivery today and Razorpay once `SITE_CONFIG.onlinePayments` is true, see and cancel their orders and re-order, with every amount computed on the server, every Razorpay callback verified, webhooks deduplicated and a cron that reconciles what a lost callback left behind, in 21 tasks of at most 400 changed lines each.

**Architecture:**
- The rules stay pure: `src/server/orders/status.ts` (the merged state machine, extended here for actors, Rx-free orders and the F16 refund deferral) and a new `src/server/orders/rules.ts` (COD cap, cancel reasons, payment options, the placement Rx check, line snapshots). Mongo repositories (`orders.ts`, `addresses.ts`, `webhook-events.ts`) and services (`place.ts`, `payment.ts`, `refunds.ts`, `customer.ts`, `reconcile.ts`) sit beside them; route handlers under `src/app/api/{orders,checkout,payments,account,cron}/**` stay thin.
- An order is written once with a snapshot of its lines, totals, address and `rxId`; every later change is `applyTransition`: the pure `transition()` plus a conditional update on `{ _id, status: from }` and an `order.status` audit row **in one MongoDB transaction**. Placement inserts the order, clears the cart (compare-and-set on the cart's `rev`) and writes the audit row in one transaction. Money leaves only through `executeRefund`, which claims the order first, so two callers cannot refund twice.
- Payments sit behind the `PaymentGateway` interface in `getDeps()`: a Mongo-backed fake (dev, test, e2e, previews), a `fetch`-based Razorpay adapter (no SDK) and a `none` gateway for a COD-only production. One contract test suite runs against the fake and against the adapter over MSW. The browser's success callback, the webhook and the cron all end in the same idempotent `capturePayment`.
- Checkout and order pages are static shells; per-user content loads on the client after hydration, like the cart and the header session.

**Tech Stack:** Next.js 16.4 route handlers and pages (Cache Components on), React 19.3, TypeScript 6.0 strict, `mongodb` 7.9 (sessions and transactions on the replica set; `MongoMemoryReplSet` in int tests) + zod 4.6, Razorpay REST API v1 over `fetch` (Orders, Payments, Refunds, webhooks, Checkout.js in the browser), Vercel Cron, Vitest 5 (`unit`, `ui`, `int`), MSW, Playwright 1.65.

**Spec:**
- `docs/requirements.md` (the authority; there is no separate spec): §5.4 (at checkout: upload new, choose a previous one, or reuse the Rx from a past order), §5.5 Cart and checkout, §5.6 Orders, §6 (audit trail; "Rejection puts them On hold and, if prepaid, flags a refund"), §7 business rules (owner accepted the defaults: Rx 6 months, 10 per product and 20 packs per order, COD ≤ ₹5,000, pay first with refund if the Rx is rejected, cancel until Packed, refund to source in 5–7 working days), §9 security (prices computed on the server, payment signatures verified), §10 (no Rx content in messages).
- `docs/plan/project-plan.md`, Stage 5: the data model (`orders`: snapshot, totals, payment, rxStatus, statusHistory, shipment; `webhook_events`; `audit_logs`; `counters`), the order state machine, the phase row **O** ("order domain; COD placement (idempotent, priced on the server); checkout stepper; order history; Razorpay order + verify; webhook; checkout UI and reconcile cron"), Security and compliance, Stage 6 (online payments hidden until live keys).
- `docs/handoff.md` "What is next", row O (carried obligations, all placed below) and "Known issues" (F16).
- `docs/decisions/rulings.md`: "Prescription validity" (placement at `createdAt`, transitions at `ctx.at`), "State machine", "Order number", requirements defaults, the K+R plan's checkout and `onlinePayments` rulings; `docs/decisions/phase-f-ledger.md` ("Ledger for O5: fake gateway per-process HMAC/in-memory state").
- `AGENTS.md` "Business invariants"; `docs/dev/architecture.md` (Principles, Request flow, Providers container, Orders and prescriptions).
- The approved prototype: `design/prototype/pages/checkout.html` (states Address, Address errors, Prescription, Upload Rx, Payment, COD unavailable, Review), `order.html` (Just placed, Shipped, Delivered, On hold, Cancelled; the cancel dialog), `account.html?state=account-orders`, copy in `design/prototype/js/flows.js`, styles in `design/prototype/css/flows.css`.
- Code at `main` 93c6bf0 (#213).

**Task ids.** The merged order domain (#35, #36, #38, #39: `status.ts`, `order-number.ts`, Rx validity) is called **O0** here. This plan's tasks are O1–O21. Older documents use other numbers: the handoff's and rulings' "O2 COD placement" is **O6** here, and the F ledger's "O5 fake gateway" is **O4**.

## Global Constraints

Carried (repo rules; AGENTS.md wins if it differs). Every Global Constraint of the K+R plan (`2026-11-27-phase-kr-cart-prescriptions.md`) applies; the ones O tasks touch are restated:
- Branch `type/short-desc` from up-to-date `origin/main`; Conventional Commits; small atomic commits (refactor, format and behaviour apart); squash merge. **No `Co-Authored-By` trailer and no "Generated with" line.** PR body: What / Why / How tested (with the command output) / Risks and rollback.
- **≤ 400 changed lines per PR** (`pnpm pr-size origin/main`), Markdown included. Only `docs/superpowers/**`, `docs/decisions/**`, the lockfile, `data/**`, `public/**`, binaries and `// @generated shadcn` files are excluded. Over the cap, split at the seam the task names onto a fresh branch from `origin/main`. Never trim tests or meaningful docs to fit, never touch the guard.
- Merge gate: `lint`, `typecheck`, `unit`, `int`, `build`, `e2e`, `pr-title`, `branch-name`, `pr-size`, each `pass` by name, through `scripts/merge-gate.sh`. Implementers never merge their own PRs. After a background merge, confirm with `gh pr view <n> --json state` before dispatching dependants. No force-pushes; never rebase pushed work.
- **Definition of done:** tests first, then the full local check green: `pnpm lint && pnpm typecheck && pnpm test:unit && pnpm test:int && pnpm build`, then `pnpm db:up && MONGODB_DB=aarvion_e2e pnpm db:indexes && MONGODB_DB=aarvion_e2e pnpm seed && pnpm test:e2e`. Plus a `CHANGELOG.md` line under `## [Unreleased]` ending with the PR number; `docs/dev/**` updated (in `architecture.md` only your own files' bullets, collection rows and rate-limit keys); a ruling in `docs/decisions/rulings.md` for any rule that changes.
- **Routes:** mutations call `assertSameOrigin(req)` inside `withErrors` (except the webhook and the cron, which are server-to-server and authenticate by signature or secret); per-user responses use `jsonResponse` (`no-store`); cookies are read from `req.headers`; every GET handler's first statement is `await connection()`; no route exports `dynamic`, `revalidate` or `fetchCache`; every customer route that calls `requireUser` merges `sessionRefreshHeaders(auth)` into its response.
- **Time:** `src/server/**` never calls `new Date()` or `Date.now()`; functions take `now: Date`; routes read `getDeps().now()` once per request.
- **Atomicity:** a single-document race is a conditional update (`{ _id, status: from }`, `{ _id, rev }`, a claim on `claimUntil`) or an upsert with one E11000 retry. Writes that must land together run in `withTransaction` (Task O2): order insert + cart clear + audit; status change + audit; payment capture + status + cart clear + audit. Never an unconditional read-then-write.
- **Indexes:** explicit `name`; the module is imported by `src/server/db/register-all.ts`; never change one in place; a lookup meant to hit a partial index carries its `$type`.
- **Inputs** reach Mongo only as zod-parsed primitives. Ids from a URL or body are 24 hex characters (`ObjectId`) or match a fixed regex; nothing becomes a regex, an operator object or a field name.
- **Logs and messages:** error names only. Never log or return a patient name, an address, a phone, an email, a cancel note, a Razorpay signature, a key or secret, or a webhook body. Audit rows hold ids, codes, amounts and flags only. **No prescription content** in any log, audit `meta`, SMS, email or toast.
- **Secrets:** the repo is public. Razorpay keys, the webhook secret, `CRON_SECRET` and `FAKE_PAYMENTS_SECRET` live only in Vercel env and local `.env.local`; `.env.example` names them with empty values. A test that needs a secret generates one.
- **Client imports:** `src/components/**` and client-safe `src/lib/**` import at runtime from `src/server/**` only `catalogue/pricing`, `catalogue/search`, `catalogue/order`, `cart/rules` and, from Task O1, `orders/rules`; anything else is `import type` (`src/components/server-imports.test.ts`).
- **Prices:** computed only by `sellingPricePaise()` and `cartTotals()`; placement prices from `readCart` + `getPurchasableBySlugs` (Mongo, never `getCachedProducts()` and never the request body). UI code never reads `pricePaise` or `MRP_DISCOUNT_PAISE` and never writes `- 2000` (`src/lib/price-source.test.ts`); order amounts render through `Rupees`, `StampPrice` or `PriceInline`. No headline leads with the ₹20.
- **Copy:** online-payment, UPI/card and refund copy is gated on the server's `payment.onlineEnabled` in checkout and on `SITE_CONFIG.onlinePayments` in static pages; with it off, only cash-on-delivery wording, and prepaid refund wording is conditional ("If you paid online, …") or omitted. Prototype strings are used verbatim; new strings sit in one copy module per feature, marked "awaiting owner approval". `findClaims` runs on every new page's and section's rendered text.
- **Accessibility, CSS, hydration and Cache Components:** exactly as in the K+R plan (one polite live region through `announce()`; `ErrorSummary` for two or more invalid fields; targets ≥ 44 px; each new `src/styles/<x>.css` imported into `layer(components)` by `globals.css` and listed in its task; no repeated selectors; prototype class names kept, `var(--color-line-strong)` never `var(--line-strong)` [C13]; motion on `transform` and `opacity` only, static under reduced motion; no `sessionStorage`/`window` read during render; no root-layout Suspense; per-user content after hydration).
- **Routes map:** link through `ROUTES`; an unbuilt linked page stays in `PENDING_ROUTES` until its task deletes the entry and adds the page to `START`.
- **Mocks:** forbidden in production as `isMockForbidden()` decides; `PAYMENTS_PROVIDER=fake` is a mock, `none` is not.
- **Budgets:** product 170 kB and home 175 kB first-load JS ratchets hold; Checkout.js loads only when the customer chooses to pay online.

Business values, used verbatim:
- **Price:** unit price = MRP − ₹20 = `sellingPricePaise(mrpPaise)` (`mrpPaise − 2000`), integer paise; MRP ≥ 2100. Totals = `cartTotals(lines)`: MRP total, discount 2000 × packs, delivery 0 ("Free"), payable = Σ unit × qty. "Inclusive of all taxes".
- **Caps:** `CART_LIMITS = { perProduct: 10, perOrder: 20 }`; placement refuses a cart outside them (`cart_changed`).
- **COD:** `COD_LIMIT_PAISE = 500_000`; COD is allowed when payable ≤ 500,000 paise (exactly ₹5,000 is allowed).
- **Rx:** every line with `rxRequired` needs one `rxId` of the customer's own prescription that is `pending`, or `approved` and `isRxValidOn(rx, createdAt)`. Validity is 6 calendar months on the IST wall clock, end exclusive. Confirm, pack and ship judge the Rx currently attached at `ctx.at`.
- **States:** `pending_payment → placed | cancelled`; `placed → confirmed | on_hold | cancelled`; `on_hold → confirmed | cancelled`; `confirmed → packed | on_hold | cancelled`; `packed → shipped | on_hold`; `shipped → delivered`. `delivered` and `cancelled` are final. COD starts at `placed`, prepaid at `pending_payment`. Ship needs AWB and courier, then a valid Rx, then COD or paid.
- **Customer cancel:** with a reason, from `pending_payment`, `placed`, `on_hold` or `confirmed` (the cancel edges; nothing after packing).
- **Order number:** `AAR-YYMM-NNNNN`, IST month, monthly sequence, never truncated; regex `^AAR-\d{4}-\d{5,}$`.
- **Timers:** an unpaid `pending_payment` order is cancelled after 60 minutes; the cron runs every 10 minutes; an `on_hold` order with no approved replacement Rx is cancelled after 7 days.

## Review Focus

1. **A double tap on Place order, or a retry after a 4G drop.** Expected: exactly one order and one cart clear; the second request gets the same order number. Tests: Task O6 (a replayed `placeOrder` after the cart was cleared returns the first order with `replay: true`); Task O8 (two parallel `POST /api/orders` with one `idempotencyKey` → one `orders` document, both responses carry the same `number`).
2. **The checkout success callback, the webhook and the cron all report the same payment.** Expected: one `pending_payment → placed` transition, one `payment.paid` audit row, the cart cleared once, and the losers answer "already". Tests: Task O10 (three parallel `capturePayment` calls → one history entry); Task O12 (the same event delivered twice → processed once).
3. **The customer pays at minute 59 and the cron cancels the order at minute 60** (or a payment lands on an order already cancelled by the customer). Expected: the order stays cancelled and the captured money is refunded automatically, once. Test: Task O10 (capture on a cancelled order → `refund_pending`, `executeRefund` called once, a second capture does not refund again).
4. **The cart or an MRP changes between Review and Place order** (another tab adds a pack; staff edit an MRP; a product is retired). Expected: 409 `cart_changed` or `price_changed` with the fresh priced cart, never an order for an amount the customer did not see. Tests: Task O6 (stale `cartRev`; raw `updateOne` of `mrpPaise`; `active: false`).
5. **Someone else's or an unusable prescription or address:** another user's `rxId` or `addressId`, a rejected Rx, an Rx that expired an hour ago, an order number of another user. Expected: refused with the same answer as a missing record (`rx_not_found`, `address_not_found`, 404 `not_found`), no existence oracle, nothing written. Tests: Task O6 and Task O11.

## Decisions taken in this plan (rulings; override any)

Each line is "Ruling: what — why — cost if wrong". Copied into `docs/decisions/rulings.md` ("Phase O plan (provisional)") in the docs PR that commits this plan.

**Domain**
- Ruling: the merged domain is O0 and this plan's tasks are O1–O21, with the mapping above — the handoff and ledgers already say "O2" and "O5" for work whose scope changed — cost if wrong: a reader follows an old task number to the wrong task once.
- Ruling (F16): a `hold` on a paid order only **flags** the refund (`payment.status = "refund_pending"` in the same write, effect `flag_refund`); the refund is **executed** on `cancel` (effect `refund`); `confirm` from `on_hold` with `refund_pending` is allowed and returns the payment to `paid` (effect `unflag_refund`) — the spec says rejection "flags a refund", and executing it at once made a held prepaid order un-resumable after a pharmacist approves a replacement Rx — cost if wrong: a rejected customer waits for the cancel (by staff, by themselves, or the 7-day auto-cancel) before the refund starts.
- Ruling: an order on hold for 7 days without a confirm is cancelled by the cron (`by: "system"`, reason `prescription_not_approved`), which executes any refund — this is the "automatic refund if the Rx is rejected" the owner accepted, without refunding a customer who is about to upload a replacement — cost if wrong: one constant (`ON_HOLD_TTL_MS`).
- Ruling: actor rules live in the pure `transition()`: `payment_captured` by `system`; `confirm`, `hold`, `pack`, `ship`, `deliver` by `staff`; `cancel` by anyone (the customer window equals the cancel edges, so nothing after packing); anything else is `forbidden_actor` — "hold is staff-only" is then a tested invariant, not an API convention — cost if wrong: a later staff-side system action needs one more actor case.
- Ruling: `OrderForTransition.rx` becomes `RxSnapshot | null`, where `null` means the order has no Rx line and the Rx guard is skipped — every product today is Rx, but the cart already supports non-Rx groups — cost if wrong: none while every product is Rx.
- Ruling: order lines store a snapshot (`slug`, `name`, `packLabel`, `rxRequired`, `mrpPaise`, `unitPaise`, `qty`, `image`) and the order stores `totals` — an order is a record of a sale and must not change when an MRP does; "price is derived, never stored" governs the catalogue and carts — cost if wrong: none; the field is named `unitPaise` so the UI price-source guard (which bans `pricePaise`) still holds.
- Ruling: there is no stock or inventory in v1 (no field exists and the spec names none); the transactions cover order insert + cart clear + audit, and status change + audit — cost if wrong: an oversold pack is handled by staff cancelling (D).
- Ruling: the order number is taken (`nextOrderNumber`) **before** the placement transaction, so a failed placement leaves a gap in the month's sequence — a counter inside the transaction makes every concurrent checkout conflict and retry — cost if wrong: gaps in `AAR-YYMM-NNNNN`, which an auditor may ask about.
- Ruling: cancel reasons are the prototype's list, codes `ordered_by_mistake | change_items | change_address | prescription_changed | other`, plus an optional note of at most 500 characters stored in `order.cancel.note`, shown only to the customer and staff, never logged or messaged — fixed codes keep free text out of history and audit — cost if wrong: one enum.

**Placement**
- Ruling: placement takes `{ idempotencyKey (UUID), cartRev, expectedPayablePaise, addressId, rxId, method }`; `(userId, idempotencyKey)` is a unique index and a replay returns the existing order — a double tap or retry must not create a second order (Review Focus 1) — cost if wrong: none.
- Ruling: placement refuses with 409 `cart_changed` when `cartRev` differs, a line is no longer purchasable or a cap is broken, and with 409 `price_changed` when the server's payable differs from `expectedPayablePaise`; both return the fresh cart — the customer must see the amount they pay (Review Focus 4) — cost if wrong: one extra confirmation after a concurrent change.
- Ruling: the fixed check order is replay → cart (empty, rev, purchasable, caps) → price → address → Rx → payment method → number → transaction — a replay must win even after the cart was cleared, and nothing user-specific is read before the cart check — cost if wrong: an error code precedence differs from the UI's expectation.
- Ruling: the API takes only `rxId`; "choose a previous one" and "reuse the Rx from a past order" both resolve to an `rxId` on the client (the past-order list shows each order's `rxId`), and "upload new" uploads through R's flow first — one server check covers all three modes — cost if wrong: none.
- Ruling: an `rxId` sent for an order without Rx lines is ignored and not stored — cost if wrong: none.
- Ruling: COD clears the cart inside the placement transaction; prepaid keeps the cart until payment is captured and then clears it only if the cart's `rev` still equals the order's `cartRev` — an abandoned payment must not empty the cart, and a cart edited since must not be wiped — cost if wrong: a customer who edited the cart during payment keeps the edited cart after paying and removes it by hand.
- Ruling: more than one `pending_payment` order per user is allowed; the cron cancels the unpaid ones after 60 minutes — cost if wrong: an order list can briefly show an abandoned "Awaiting payment" order.
- Ruling: while `onlinePaymentsEnabled()` is false, an order whose payable exceeds ₹5,000 cannot be placed; the Payment step says so and asks to remove packs — COD is the only method and its cap is the owner's — cost if wrong: large orders (up to 20 × ₹610 = ₹12,200) are lost until go-live.
- Ruling: `onlinePaymentsEnabled()` = `PAYMENTS_PROVIDER !== "none"` and (`SITE_CONFIG.onlinePayments` or (`ONLINE_PAYMENTS_PREVIEW=1` and not `isMockForbidden()`)); the server enforces it (`online_payments_disabled`), and the checkout reads it from `GET /api/checkout` — the flag is a go-live gate, not just copy, and e2e and previews must still exercise prepaid — cost if wrong: one env flag on previews.
- Ruling: placement is limited to 20 per hour per user (`orders-place:user:<id>`); other order mutations (cancel, re-order, pay, verify) share 60 per hour (`orders:user:<id>`) — cost if wrong: two numbers.

**Addresses**
- Ruling: Phase O builds the minimal address book the Address step needs (list, add, default; at most 10, embedded as `users.addresses`), with `GET` and `POST /api/account/addresses`; edit and delete come with P1's `/account` — no address code exists yet and checkout cannot ship without it — cost if wrong: P1 adds two routes to an existing module.
- Ruling: the order stores a copy of the address, not a reference — a later edit must not change where a shipped order went — cost if wrong: none.

**Payments**
- Ruling: the Razorpay adapter uses `fetch` against `https://api.razorpay.com/v1` with Basic auth and a 10 s timeout, no SDK — four endpoints, fully mockable with MSW, no new dependency in a public repo — cost if wrong: we maintain the request shapes ourselves.
- Ruling: `PAYMENTS_PROVIDER` gains `none`, a gateway whose every call throws `GatewayError("payments_disabled")`, allowed in production — today production cannot start without a real gateway (fake is a mock, razorpay needs keys), and COD needs no gateway — cost if wrong: one enum value.
- Ruling: only a payment with status `captured` and the exact `amountPaise` of the order counts as paid; the owner turns on automatic capture in the Razorpay dashboard (an owner action) — authorised-but-uncaptured money is not ours yet — cost if wrong: with auto-capture off, prepaid orders wait for the cron and then cancel.
- Ruling: the checkout callback's signature is `HMAC-SHA256(key_secret, "<order_id>|<payment_id>")` in hex and the webhook's `HMAC-SHA256(webhook_secret, rawBody)`; both are compared with `timingSafeEqual` after a `^[0-9a-f]{64}$` check; and even a valid signature only triggers `capturePayment`, which re-fetches the payment from Razorpay — a callback or webhook body is never the source of truth for an amount — cost if wrong: one API call per payment.
- Ruling: a captured payment whose order or amount does not match is not applied; it writes a `payment.mismatch` audit row and leaves the order untouched for staff (D) — Razorpay enforces the order amount, so this only happens under tampering or a bug — cost if wrong: a stuck prepaid order needs staff action.
- Ruling: a payment captured on an order that is already `cancelled` sets `refund_pending` and is refunded at once — the late-payment race must never keep a customer's money (Review Focus 3) — cost if wrong: none.
- Ruling: refunds are full refunds only, executed by `executeRefund`, which first claims the order (`payment.refund.claimUntil`, a 5-minute lease) and sends Razorpay `receipt: "rf_<order number>"`; the adapter first lists the payment's refunds and returns an existing one with that receipt — Razorpay has no idempotency key for refunds, and a lost response must not refund twice — cost if wrong: partial refunds (one pack damaged) need a later task.
- Ruling: the webhook dedupes on the `x-razorpay-event-id` header (the SHA-256 of the raw body when absent) in `webhook_events`: a `processing` claim, `done` after handling, 409 to an event still processing (Razorpay retries), takeover of a claim older than 5 minutes or `failed`; rows expire after 90 days — Razorpay retries for about a day and may deliver twice — cost if wrong: a replay older than 90 days is processed again, which every handler tolerates.
- Ruling: handled events are `payment.captured` and `order.paid` (capture), `payment.failed` (audit only), `refund.processed` (mark refunded) and `refund.failed` (release the claim so the cron retries); any other event is stored as `done` and ignored — cost if wrong: none.
- Ruling: the fake gateway keeps its state in a dev-only Mongo collection `dev_fake_gateway` and signs with `FAKE_PAYMENTS_SECRET` (a per-process random value when unset) — the F ledger's per-process in-memory fake cannot survive HMR, two Vercel functions or a Playwright browser — cost if wrong: previews need one more env value.
- Ruling: in the browser, a gateway key id of `"fake"` sends the customer to the dev-only page `/dev/pay/[gatewayOrderId]` (Pay or Fail buttons) instead of Checkout.js — e2e and previews then run the whole redirect-and-verify path without Razorpay — cost if wrong: Checkout.js itself is exercised only by the manual test-key smoke.
- Ruling: Checkout.js (`https://checkout.razorpay.com/v1/checkout.js`) is injected only when the customer presses Pay; phase H's CSP must allow `script-src https://checkout.razorpay.com` and `frame-src https://api.razorpay.com` — cost if wrong: online payment breaks when CSP lands; the e2e prepaid case runs on the fake page, so H must add a CSP test.
- Ruling: a `rzp_test_` key is refused by `getDeps()` only when `isMockForbidden()` and `SITE_CONFIG.onlinePayments` are both true — test keys are fine on a COD-only production, never on a live one — cost if wrong: none.

**Cron**
- Ruling: one route `GET /api/cron/reconcile`, scheduled `*/10 * * * *` in `vercel.json`, authenticated with `Authorization: Bearer <CRON_SECRET>` (timing-safe; Vercel sends it), each step handling at most 50 orders oldest first, with no lock because every step is a conditional update or a claim — cost if wrong: Vercel Hobby runs crons once a day (owner action 4 already asks for Pro).
- Ruling: reconcile steps are: capture a `pending_payment` order older than 15 minutes whose gateway order has a captured payment; cancel one older than 60 minutes without (reason `payment_not_completed`); execute refunds that are due and unclaimed; poll refunds requested more than an hour ago; auto-cancel `on_hold` orders older than 7 days — these are every state a lost callback or webhook can leave — cost if wrong: each is one constant.

**Pages**
- Ruling: `/checkout` lives in a new route group `src/app/(checkout)/` whose layout has the prototype's reduced header ("Secure checkout") and the full store footer (the legal facts must show on every page) — cost if wrong: one layout.
- Ruling: order history is `/account/orders` and the detail and confirmation page is `/order/[number]`, both static shells that fetch on the client; P1 wraps `/account/orders` in its tab rail; the footer's "Track an order" moves from `/account` to `/account/orders` — `/account` stays pending until P1 — cost if wrong: P1 moves one link back.
- Ruling: `/order/[number]` reads its number with `useParams()` in a client component inside a leaf Suspense with a static fallback; the page itself never awaits `params` — the shell must stay static under Cache Components — cost if wrong: the build reports a blocking route and the page moves to `/account/orders/view?n=`.
- Ruling: re-order uses the guest-merge rule (`mergeGuestCart`: the larger quantity per slug, cut at 20 packs, retired products dropped and reported) — a double tap on Re-order must not double the cart — cost if wrong: a customer who wants two orders' worth taps + once.
- Ruling: the checkout idempotency key is a `crypto.randomUUID()` kept in `sessionStorage` key `aarv-checkout-v1` as `{ cartRev, key }`, reused while `cartRev` is unchanged and replaced when it changes — a reload of Review must replay, not duplicate — cost if wrong: none.
- Ruling: the order page drops the prototype's "We’ll text and email you when your order is approved" until N builds notifications — cost if wrong: one string N restores.
- Ruling: the invoice download (§5.6) is not built in O, because who issues the GST invoice and the HSN codes and rates are open (owner action 8) — cost if wrong: a delivered order has no invoice until the owner answers.

## File Structure

```
src/server/orders/            status.ts (extended) rules.ts (pure, client-safe) orders.ts (repo + applyTransition)
                              view.ts (customer views, timeline) checkout.ts (GET /api/checkout model)
                              place.ts (placeOrder, ensureGatewayOrder) payments-config.ts (onlinePaymentsEnabled)
                              refunds.ts (executeRefund, markRefundProcessed) payment.ts (capturePayment, verifyCheckoutPayment)
                              customer.ts (cancel, reorder) reconcile.ts http.ts (shared zod bodies, limits)
src/server/account/           addresses.ts india.ts (states and union territories)
src/server/payments/          webhook-events.ts webhook.ts
src/server/providers/         types.ts (PaymentGateway v2) fake-payments.ts (Mongo-backed) razorpay.ts none-payments.ts
src/server/db/                transaction.ts (withTransaction)
src/server/audit.ts           (+ session option, order and payment actions)
src/server/cart/carts.ts      (+ clearCart)
src/app/api/account/addresses/route.ts
src/app/api/checkout/route.ts
src/app/api/orders/           route.ts [number]/route.ts [number]/cancel/route.ts [number]/reorder/route.ts [number]/pay/route.ts
src/app/api/payments/         verify/route.ts webhook/route.ts
src/app/api/cron/reconcile/route.ts
src/app/dev/pay/              [id]/page.tsx route.ts
src/app/(checkout)/           layout.tsx checkout/page.tsx
src/app/(store)/order/[number]/page.tsx
src/app/(store)/account/orders/page.tsx
src/components/checkout/      checkout-copy.ts checkout-api.ts stepper.ts checkout-page.tsx reduced-header.tsx
                              address-step.tsx address-form.tsx rx-step.tsx payment-step.tsx review-step.tsx pay-online.ts
src/components/orders/        order-copy.ts orders-api.ts order-detail.tsx order-timeline.tsx cancel-dialog.tsx order-list.tsx
src/styles/                   checkout.css orders.css
tests/helpers/                orders.ts (seedOrder, cartWith) payment-contract.ts razorpay-msw.ts
vercel.json                   (crons)
e2e/                          checkout.spec.ts orders.spec.ts
```

New collections: `orders`, `webhook_events`, `dev_fake_gateway` (dev and test only). `users` gains `addresses`.

**Order and parallelism** (each arrow is "merged before"):
- **Wave 1, now, in parallel with K4–K7 and R5–R7** (pure or server-only, disjoint files): **O1** (pure rules), **O3** (address book), **O4** (gateway contract and fake).
- O1 → **O2** (order store) → **O6**, which also needs O3 and the merged K2 (`readCart`, `getPurchasableBySlugs`) and R4 (`getRxForUser`, on `main` since #198).
- O4 → **O5** (Razorpay adapter). O2 + O3 → **O7** (views and checkout model). O6 + O7 → **O8** (checkout and place routes).
- O2 + O4 → **O9** (refunds) → **O10** (capture, verify, pay; also needs O6) → **O12** (webhook) and **O13** (cron, also needs O9).
- O7 + O9 → **O11** (customer order routes).
- UI: O8 + K6 (`ROUTES.checkout`, `/checkout` in `PENDING_ROUTES`, `OperateShell`, `CartSummary`) → **O14** (shell) → **O15** (address step) → **O16** (Rx step; also needs R6 `RxUploadForm`) → **O17** (payment, review, place; also needs O10).
- O11 + O17 → **O18** (order detail) → **O19** (order list and links; also needs K6 for the cart empty state).
- O17 + O19 + R7 → **O20** (e2e). **O21** (finish-review gate) runs last.
- Hotspots, so merge serially and merge `origin/main` before the last push: `src/server/env.ts` and `deps.ts` (O4, O5, O6, O13); `src/server/audit.ts` and `register-all.ts` (O2, O3, O12); `src/config/routes.ts` and `e2e/links.spec.ts` (O17, O18, O19); `src/app/globals.css` (O14, O18); CHANGELOG and `architecture.md` (all).

---

### Task O1: Order rules and the extended state machine (PR `feat/order-rules`)

**Files:**
- Modify: `src/server/orders/status.ts`, `src/server/orders/status.test.ts`, `src/components/server-imports.test.ts` (allow `orders/rules`).
- Create: `src/server/orders/rules.ts`, `src/server/orders/rules.test.ts`.
- Docs: `docs/dev/architecture.md` (bullets for both files; "Orders and prescriptions"), `AGENTS.md` (the state-machine invariants: actors, `rx: null`, the three effects), `CHANGELOG.md`.

**Interfaces:**
- Consumes: `isRxValidOn`, `RxSnapshot` (validity.ts); `cartTotals`, `sellingPricePaise`, `CartTotals` (pricing.ts); type-only `PricedLine` (`cart/service.ts`).
- Produces (`status.ts`):
  - `OrderForTransition.rx: RxSnapshot | null` (null: no Rx line, Rx guard skipped).
  - `type OrderEffect = "refund" | "flag_refund" | "unflag_refund"`; `TransitionResult` ok branch carries `effects: OrderEffect[]`.
  - `TransitionErrorCode` gains `"forbidden_actor"`. Actor table: `payment_captured` → `system`; `confirm | hold | pack | ship | deliver` → `staff`; `cancel` → any. Checked after the edge check, before the guards.
  - Effects: `hold` with `paymentStatus "paid"` → `["flag_refund"]`; `cancel` with `"paid"` or `"refund_pending"` → `["refund"]`; `confirm` from `on_hold` with `"refund_pending"` passes the payment guard and returns `["unflag_refund"]`. `ship` still needs `"cod"` or `"paid"`.
- Produces (`rules.ts`, client-safe; runtime imports only the pure `catalogue/pricing` and `prescriptions/validity`; type-only otherwise):
  - `COD_LIMIT_PAISE = 500_000`; `PENDING_PAYMENT_TTL_MS = 3_600_000`; `CAPTURE_CHECK_AFTER_MS = 900_000`; `ON_HOLD_TTL_MS = 604_800_000`.
  - `CANCEL_REASONS = ["ordered_by_mistake", "change_items", "change_address", "prescription_changed", "other"] as const`; `type CancelReason`; `CANCEL_NOTE_MAX = 500`.
  - `CUSTOMER_CANCELLABLE: readonly OrderStatus[]` = `["pending_payment", "placed", "on_hold", "confirmed"]`; `canCustomerCancel(status): boolean`.
  - `paymentOptions(i: { payablePaise: number; onlineEnabled: boolean }): { online: boolean; cod: { allowed: boolean; reason: "over_limit" | null } }`.
  - `rxNeeded(lines: readonly { rxRequired: boolean }[]): boolean`.
  - `rxUsableAt(rx: RxSnapshot, at: Date): "ok" | "rx_rejected" | "rx_expired"` (pending → ok; approved and valid at `at` → ok; approved otherwise → expired; rejected → rejected).
  - `type OrderLine = { slug: string; name: string; packLabel: string; rxRequired: boolean; mrpPaise: number; unitPaise: number; qty: number; image: ProductImage }`; `snapshotLines(lines: readonly PricedLine[]): { lines: OrderLine[]; totals: CartTotals }` (`unitPaise = sellingPricePaise(mrpPaise)`; totals by `cartTotals`).

- [ ] **Step 1: Write the failing tests**
  - `status.test.ts` (extend, keep every existing case green after adapting `effects` and `by`):
    - `transition(placedCod, { type: "hold", reason: "x" }, { at, by: "customer" })` → `{ ok: false, error: "forbidden_actor" }`; the same `by: "staff"` → ok.
    - `confirm` by `"system"` → `forbidden_actor`; `payment_captured` by `"staff"` → `forbidden_actor`; `cancel` by `"customer"` from `confirmed` → ok; from `packed` → `invalid_transition`.
    - Paid prepaid `hold` → `effects: ["flag_refund"]`; paid `cancel` → `["refund"]`; `refund_pending` `cancel` from `on_hold` → `["refund"]`.
    - `on_hold`, prepaid, `refund_pending`, approved valid Rx: `confirm` by staff → ok with `["unflag_refund"]`; the same order `ship` (from packed, with `refund_pending`) → `payment_required`.
    - `rx: null`: `confirm` and `pack` pass; `ship` with AWB passes for COD.
  - `rules.test.ts`:
    - `paymentOptions({ payablePaise: 500_000, onlineEnabled: false })` → COD allowed; `500_001` → `{ allowed: false, reason: "over_limit" }`, `online: false`.
    - `rxUsableAt` with `rxDate = istMidnight("2026-05-28")` approved: at `2026-11-27T18:29:59.999Z` → ok; at `2026-11-27T18:30:00.000Z` → `rx_expired`; pending with null dates → ok; rejected → `rx_rejected`.
    - `snapshotLines([{ sacuwin-100, mrpPaise 40700, qty 2 }, { hyloage, mrpPaise 42500, qty 1 }])` → `unitPaise` 38700 and 40500; totals `payablePaise` 117900, `discountPaise` 6000.
    - `canCustomerCancel("packed") === false`; `CUSTOMER_CANCELLABLE` equals the statuses whose `ORDER_EDGES` include `cancelled`.
  - `server-imports.test.ts`: a component importing `@/server/orders/rules` passes; `@/server/orders/orders` fails.
- [ ] **Step 2: Run** `pnpm exec vitest run --project unit src/server/orders src/components/server-imports.test.ts`. Expected: FAIL (`forbidden_actor` unknown, `rules.ts` missing).
- [ ] **Step 3: Implement** the actor table and effects in `status.ts` (rewrite the F16 header comment to the new rule) and `rules.ts`.
- [ ] **Step 4: Run** it (expected: PASS), then the full local check.
- [ ] **Step 5: Commit** `feat(orders): add actor rules, the refund deferral and order rules`.

### Task O2: Order store, transactions and transition persistence (PR `feat/order-store`)

**Depends on:** O1.

**Files:**
- Create: `src/server/db/transaction.ts`, `src/server/orders/orders.ts`, `tests/helpers/orders.ts`, `tests/int/order-store.test.ts`.
- Modify: `src/server/audit.ts` (+ `audit.test.ts`), `src/server/db/register-all.ts`, `docs/dev/architecture.md` (bullets; `orders` row; the transaction rule under Principles), `docs/dev/testing.md` (helper row), `CHANGELOG.md`.

**Interfaces:**
- Consumes: O1 `transition`, `OrderEvent`, `OrderEffect`, `OrderLine`; `getMongoClient`, `getDb`; `RxDoc` (`prescriptions.ts`).
- Produces:
  - `withTransaction<T>(fn: (session: ClientSession) => Promise<T>): Promise<T>`: `client.withSession(s => s.withTransaction(() => fn(s), { readConcern: { level: "snapshot" }, writeConcern: { w: "majority" } }))`, returning `fn`'s value; transient errors are retried by the driver.
  - `appendAudit(entry, opts?: { session?: ClientSession })`. `AuditAction` gains `"order.place" | "order.status" | "payment.paid" | "payment.mismatch" | "payment.refund_requested" | "payment.refunded"`.
  - `ORDERS_COLLECTION = "orders"`; indexes `number_unique`, `userId_idempotencyKey_unique`, `userId_createdAt_desc`, `status_updatedAt`, `payment_gatewayOrderId_unique` (unique, partial `{ "payment.gatewayOrderId": { $type: "string" } }`), `rxId_status`.
  - ```ts
    type OrderDoc = {
      _id: ObjectId; number: string; userId: ObjectId; idempotencyKey: string; cartRev: number;
      status: OrderStatus; lines: OrderLine[]; totals: CartTotals;
      address: AddressSnapshot;           // Task O3's shape
      rxRequired: boolean; rxId: ObjectId | null;
      payment: {
        method: PaymentMethod; status: PaymentStatus;
        gatewayOrderId: string | null; paymentId: string | null; paidAt: Date | null;
        codCollectedAt: Date | null;      // set by phase D
        refund: { id: string | null; claimUntil: Date | null; requestedAt: Date | null; processedAt: Date | null } | null;
      };
      cancel: { reason: CancelReason | "payment_not_completed" | "prescription_not_approved"; note: string | null; by: Actor } | null;
      shipment: { courier: string; awb: string; trackingUrl: string | null } | null;   // set by phase D
      statusHistory: StatusHistoryEntry[]; createdAt: Date; updatedAt: Date;
    };
    ```
  - `insertOrder(doc, session)`; `findOrderForUser(number, userId)`; `findOrderByKey(userId, idempotencyKey)`; `findOrderByGatewayOrderId(id)`; `listOrdersForUser(userId, limit = 50)` (newest first); `getRxSnapshot(rxId: ObjectId | null): Promise<RxSnapshot | null>` (a missing Rx doc is `{ status: "rejected", rxDate: null, validUntil: null }`, so it fails closed).
  - `applyTransition(i: { order: OrderDoc; event: OrderEvent; by: Actor; actor: AuditEntry["actor"]; now: Date; set?: Record<string, unknown>; session?: ClientSession }): Promise<{ ok: true; order: OrderDoc; effects: OrderEffect[] } | { ok: false; error: TransitionErrorCode | "conflict" }>`: builds the snapshot (`rx: null` when `!rxRequired`), calls `transition`, then in `withTransaction` (or the given session) runs `findOneAndUpdate({ _id, status: from }, { $set: { status: to, updatedAt: now, ...set, ...effectSet }, $push: { statusHistory: entry } }, { returnDocument: "after" })`, where `flag_refund` and `refund` set `payment.status: "refund_pending"` and, when `payment.refund` is null, `payment.refund: { id: null, claimUntil: null, requestedAt: null, processedAt: null }`, and `unflag_refund` sets `"paid"`; plus `appendAudit({ action: "order.status", target: { type: "order", id }, meta: { from, to, by } })` in the same session. A null result is `conflict`.
  - `tests/helpers/orders.ts`: `seedOrder(overrides: Partial<OrderDoc>): Promise<OrderDoc>` (a valid COD `placed` order of the seeded `sacuwin-100` × 2 unless overridden) and `seedRx(userId, overrides)` (an approved Rx with `rxDate` 30 days before the clock).

- [ ] **Step 1: Write the failing tests** (`tests/int/order-store.test.ts`)
  - `withTransaction`: an insert followed by a thrown error leaves no document.
  - `applyTransition` (staff `confirm` of a seeded placed COD order with a valid Rx) → ok, `status "confirmed"`, one history entry, one `order.status` audit row with `meta: { from: "placed", to: "confirmed", by: "staff" }`.
  - Two parallel staff `confirm` calls on one order → exactly one ok, the other `conflict`; one history entry, one audit row.
  - A paid prepaid `placed` order, staff `hold` → `payment.status "refund_pending"` in the same document version; effects `["flag_refund"]`.
  - An order whose `rxId` points at a deleted Rx → staff `confirm` → `rx_not_valid`, nothing written.
  - An audit insert that throws inside the transaction (spy) leaves the order status unchanged.
  - Indexes: inserting two orders with the same `(userId, idempotencyKey)` → E11000; the same `number` → E11000; two orders with `gatewayOrderId: null` → fine.
  - `audit.test.ts`: `appendAudit` with a session commits with the transaction and not without it.
- [ ] **Step 2: Run** `pnpm exec vitest run --project int tests/int/order-store.test.ts && pnpm exec vitest run --project unit src/server/audit.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** it (expected: PASS), then the full local check.
- [ ] **Step 5: Commit**
  - `feat(db): add withTransaction and a session option on appendAudit`;
  - `feat(orders): add the order store and applyTransition`.

  Split seam if over 400 lines: `transaction.ts` + the audit change in a first PR.

### Task O3: Address book (PR `feat/address-book`)

**Files:**
- Create: `src/lib/india-states.ts`, `src/server/account/india.ts`, `src/server/account/addresses.ts`, `src/server/account/addresses.test.ts`, `src/app/api/account/addresses/route.ts`, `tests/int/addresses.test.ts`.
- Modify: `src/server/auth/users.ts` (`UserDoc.addresses?: AddressDoc[]`), `docs/dev/architecture.md`, `CHANGELOG.md`.

**Interfaces:**
- Consumes: `PersonName` (`auth/login.ts`); `requireUser`, `sessionRefreshHeaders`, `hitRateLimit`, `readJson`, `withErrors`, `assertSameOrigin`.
- Produces:
  - `INDIAN_STATES` in the client-safe `src/lib/india-states.ts` (no imports): the 28 states and 8 union territories, spelled exactly as the prototype's `<select>` in `checkout.html`, as a `const` tuple; `src/server/account/india.ts` re-exports it.
  - `AddressInput = z.strictObject({ name: PersonName, mobile: z.string().regex(/^[6-9]\d{9}$/), line1: plainText(1, 120), line2: plainText(1, 120), landmark: plainText(0, 80).optional(), pincode: z.string().regex(/^[1-9]\d{5}$/), city: plainText(1, 60), state: z.enum(INDIAN_STATES), makeDefault: z.boolean() })`, where the exported `plainText(min, max)` trims and refuses Unicode control and format characters (`\p{Cc}`, `\p{Cf}`).
  - `type AddressDoc = Omit<AddressInput, "makeDefault"> & { id: string /* ObjectId hex */; isDefault: boolean; createdAt: Date }`; `type AddressSnapshot = Omit<AddressDoc, "id" | "isDefault" | "createdAt">`; `type AddressView = AddressDoc` without `createdAt`.
  - `ADDRESS_LIMIT = 10`.
  - `listAddresses(userId): Promise<AddressView[]>` (default first, then newest).
  - `addAddress(userId, input, now): Promise<{ ok: true; address: AddressView } | { ok: false; error: "address_limit" }>`: one pipeline `updateOne` filtered by `$expr: { $lt: [{ $size: { $ifNull: ["$addresses", []] } }, 10] }` that appends the new address and, when `makeDefault` or the list was empty, sets every other `isDefault` to false; `matchedCount === 0` → `address_limit`.
  - `getAddress(userId, id): Promise<AddressDoc | null>` (ownership by construction: it reads the user's own document).
  - `GET /api/account/addresses` → 200 `{ addresses }` | 401. `POST` (`AddressInput`) → 201 `{ address, addresses }` | 409 `address_limit` | 400 | 401 | 403 | 429; limit `account:user:<id>` 60 per hour.

- [ ] **Step 1: Write the failing tests**
  - `addresses.test.ts` (unit, zod): `mobile "5123456789"` refused; `pincode "012345"` refused; `"110092"` accepted; `state "Delhi"` accepted only if it is in the list (the prototype spells it "Delhi"; use the list's spelling); a `line1` containing U+202E refused; a 121-character `line1` refused.
  - `tests/int/addresses.test.ts`: first POST → `isDefault: true`; second with `makeDefault: false` → the first stays default; third with `makeDefault: true` → only it is default; the 11th → 409 `address_limit`; 11 parallel POSTs on an empty book → exactly 10 stored; no Origin → 403; no cookie → 401; GET lists default first; a console spy sees no address text.
- [ ] **Step 2: Run** `pnpm exec vitest run --project unit src/server/account && pnpm exec vitest run --project int tests/int/addresses.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** it (expected: PASS), then the full local check.
- [ ] **Step 5: Commit** `feat(account): add the address book and its routes`.

### Task O4: Payment gateway contract and the Mongo-backed fake (PR `feat/payment-gateway-contract`)

**Files:**
- Modify: `src/server/providers/types.ts`, `src/server/providers/fake-payments.ts`, `src/server/env.ts` (`FAKE_PAYMENTS_SECRET`, optional, at least 32 characters), `src/server/db/register-all.ts`, `.env.example`.
- Create: `tests/helpers/payment-contract.ts`, `tests/int/payments-fake.test.ts`.
- Docs: `docs/dev/architecture.md` (Providers container), `docs/decisions/environments.md` (the new env name), `CHANGELOG.md`.

**Interfaces:**
- Produces (`types.ts`):
  ```ts
  type GatewayPayment = { id: string; orderId: string; amountPaise: number;
    status: "created" | "authorized" | "captured" | "refunded" | "failed" };
  type GatewayRefund = { refundId: string; status: "pending" | "processed" | "failed" };
  interface PaymentGateway {
    readonly kind: "fake" | "razorpay" | "none";
    readonly publicKeyId: string | null;            // "fake" for the fake
    createOrder(i: { amountPaise: number; receipt: string; notes: Record<string, string> }):
      Promise<{ gatewayOrderId: string; amountPaise: number }>;
    fetchPayment(id: string): Promise<GatewayPayment>;
    fetchOrderPayments(gatewayOrderId: string): Promise<GatewayPayment[]>;
    verifyPaymentSignature(i: { orderId: string; paymentId: string; signature: string }): boolean;
    verifyWebhookSignature(rawBody: string, signature: string): boolean;
    refund(i: { paymentId: string; amountPaise: number; receipt: string }): Promise<GatewayRefund>;
    fetchRefund(paymentId: string, refundId: string): Promise<GatewayRefund>;
  }
  class GatewayError extends Error { constructor(readonly code: "unavailable" | "not_found" | "rejected" | "payments_disabled") }
  ```
  `verifySignature` is renamed `verifyPaymentSignature`; update its one caller in tests.
- Produces (`fake-payments.ts`): `createFakePayments(): PaymentGateway` backed by `dev_fake_gateway` (documents `{ _id, type: "order" | "payment" | "refund", … , expiresAt }`, TTL index `expiresAt_ttl`, 24 h); `refund` returns the existing refund for the same `(paymentId, receipt)`; HMAC key is `FAKE_PAYMENTS_SECRET` or a per-process random 32 bytes. Test and dev helpers, also used by `/dev/pay` (O17): `simulateFakePayment(i: { gatewayOrderId: string; outcome: "captured" | "failed" | "authorized"; amountPaise?: number }): Promise<{ paymentId: string; signature: string }>` and `signFakeWebhook(rawBody: string): string`.
- Produces (`payment-contract.ts`): `runGatewayContract(name: string, setup: () => Promise<{ gateway: PaymentGateway; pay(gatewayOrderId: string, amountPaise: number): Promise<{ paymentId: string; signature: string }>; signWebhook(raw: string): string }>)`, a `describe` block with these cases: create returns the amount; a paid order lists one captured payment of that amount; the right signature verifies and a one-character change, a shorter string and a non-hex string do not; a webhook signature over the exact raw body verifies and one over re-serialised JSON does not; two `refund` calls with one receipt return one `refundId`; `fetchRefund` returns it; `fetchPayment` of an unknown id throws `GatewayError("not_found")`.

- [ ] **Step 1: Write the failing tests**: `tests/int/payments-fake.test.ts` runs `runGatewayContract("fake", …)`, plus: state survives `resetDepsForTests()` and a second `createFakePayments()` (same Mongo); with `FAKE_PAYMENTS_SECRET` set, a signature made by one instance verifies on another.
- [ ] **Step 2: Run** `pnpm exec vitest run --project int tests/int/payments-fake.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** it (expected: PASS), then the full local check.
- [ ] **Step 5: Commit** `feat(payments): add the gateway contract and a Mongo-backed fake gateway`.

### Task O5: Razorpay adapter and the `none` gateway (PR `feat/razorpay-adapter`)

**Depends on:** O4.

**Files:**
- Create: `src/server/providers/razorpay.ts`, `src/server/providers/none-payments.ts`, `tests/helpers/razorpay-msw.ts`, `tests/int/payments-razorpay.test.ts`.
- Modify: `src/server/env.ts` (`PAYMENTS_PROVIDER` enum `fake | razorpay | none`; `RAZORPAY_KEY_ID` matching `^rzp_(test|live)_[A-Za-z0-9]+$`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, each optional), `src/server/deps.ts`, `src/server/deps.test.ts`, `.env.example`.
- Docs: `docs/dev/architecture.md`, `docs/decisions/environments.md`, `docs/dev/setup.md` (test keys in `.env.local` only; dashboard webhook URL `/api/payments/webhook` with events `payment.captured`, `payment.failed`, `order.paid`, `refund.processed`, `refund.failed`; automatic capture on), `docs/handoff.md` (owner action 6 gains "turn on automatic capture; add the webhook and its secret"), `CHANGELOG.md`.

**Interfaces:**
- Consumes: O4 interface, contract and `GatewayError`; `requireEnv`.
- Produces:
  - `createRazorpay(env): PaymentGateway` with `kind: "razorpay"`, `publicKeyId = RAZORPAY_KEY_ID`. Requests: `POST /v1/orders { amount, currency: "INR", receipt, notes }`; `GET /v1/payments/:id`; `GET /v1/orders/:id/payments`; `GET /v1/payments/:id/refunds` then, only when no refund has `receipt === i.receipt`, `POST /v1/payments/:id/refund { amount, receipt, speed: "normal" }`; `GET /v1/payments/:id/refunds/:rid`. Status mapping of Razorpay refunds: `pending → pending`, `processed → processed`, `failed → failed`. HTTP 404 → `not_found`; 400 → `rejected`; 5xx, network or the 10 s `AbortSignal.timeout` → `unavailable`. Ids in a path are checked against `^[A-Za-z0-9_]{1,64}$` before use.
  - `nonePayments: PaymentGateway` (`kind: "none"`, `publicKeyId: null`, both verifiers return false, every async call rejects with `GatewayError("payments_disabled")`).
  - `getDeps()`: `razorpay` needs all three Razorpay keys (an `EnvError` naming the first missing); `none` is never a mock; a `rzp_test_` key with `isMockForbidden()` and `SITE_CONFIG.onlinePayments` true throws.
  - `tests/helpers/razorpay-msw.ts`: `razorpayHandlers(state)`, a stateful MSW emulation of the five endpoints that checks Basic auth, plus `msPay(state, orderId, amount)` returning `{ paymentId, signature }` signed with the test key secret.

- [ ] **Step 1: Write the failing tests** (`tests/int/payments-razorpay.test.ts`)
  - `runGatewayContract("razorpay", …)` over MSW with generated test secrets.
  - A 503 → `GatewayError("unavailable")`; a handler that never answers → `unavailable` within 10 s (fake timers); a 401 → `rejected`; a path id `"../x"` throws before any request.
  - The refund list already holds receipt `rf_AAR-2611-00001` → `refund` makes no POST (MSW call count).
  - `deps.test.ts`: `PAYMENTS_PROVIDER=razorpay` without `RAZORPAY_WEBHOOK_SECRET` → `EnvError` naming it; `none` under `VERCEL_ENV=production` builds; `fake` under production still throws.
  - A console spy sees no key, secret or signature.
- [ ] **Step 2: Run** `pnpm exec vitest run --project int tests/int/payments-razorpay.test.ts && pnpm exec vitest run --project unit src/server/deps.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** it (expected: PASS), then the full local check.
- [ ] **Step 5: Commit** `feat(payments): add the Razorpay adapter and a disabled gateway`.

  Split seam if over 400 lines: `none-payments.ts` + the env and deps changes in a first PR.

### Task O6: Order placement (PR `feat/order-placement`)

**Depends on:** O1, O2, O3; K2 and R4 (on `main`).

**Files:**
- Create: `src/server/orders/place.ts`, `src/server/orders/payments-config.ts`, `tests/int/order-place.test.ts`.
- Modify: `src/server/cart/carts.ts` (`clearCart`), `src/server/env.ts` (`ONLINE_PAYMENTS_PREVIEW`, literal `"1"`, optional), `docs/dev/architecture.md`, `CHANGELOG.md`.

**Interfaces:**
- Consumes: O1 `snapshotLines`, `rxNeeded`, `rxUsableAt`, `paymentOptions`, `initialStatus`; O2 `insertOrder`, `findOrderByKey`, `withTransaction`, `appendAudit`; O3 `getAddress`; K2 `readCart`, `getCart`, `getPurchasableBySlugs`, `CartView`; K1 `cartPacks`, `CART_LIMITS`; R4 `getRxForUser`; `nextOrderNumber`; `getDeps().payments`.
- Produces:
  - `clearCart(userId: ObjectId, rev: number, now: Date, session?: ClientSession): Promise<boolean>`: `updateOne({ _id: userId, rev }, { $set: { lines: [], updatedAt: now }, $inc: { rev: 1 } })`, true when modified.
  - `onlinePaymentsEnabled(): boolean` (the ruling's formula).
  - `PlaceOrderInput = z.strictObject({ idempotencyKey: z.uuid(), cartRev: z.int().min(1), expectedPayablePaise: z.int().min(0), addressId: z.string().regex(/^[0-9a-f]{24}$/), rxId: z.string().regex(/^[0-9a-f]{24}$/).nullable(), method: z.enum(["cod", "prepaid"]) })`.
  - `type PlaceError = "cart_empty" | "cart_changed" | "price_changed" | "address_not_found" | "rx_required" | "rx_not_found" | "rx_rejected" | "rx_expired" | "cod_limit" | "online_payments_disabled"`.
  - `placeOrder(i: { user: UserDoc; input: PlaceOrderInput; now: Date }): Promise<{ ok: true; replay: boolean; order: OrderDoc } | { ok: false; error: PlaceError; cart?: CartView }>`, checks in the ruling's order. `cart` is returned with `cart_changed` and `price_changed`. The transaction: `insertOrder` (an E11000 on `userId_idempotencyKey_unique` → abort, then return `findOrderByKey` as a replay); for COD `clearCart(userId, cartRev)` (false → abort, `cart_changed`); `appendAudit({ action: "order.place", meta: { method, packs, payablePaise } })`. The order starts at `initialStatus(method)` with an empty `statusHistory` (`createdAt` is the placement time, which is when the Rx is judged) and `payment.status: "pending"`.
  - `ensureGatewayOrder(order: OrderDoc, now: Date): Promise<{ ok: true; handoff: GatewayHandoff } | { ok: false; error: "not_payable" | "gateway_unavailable" }>`: only for a prepaid `pending_payment` order; reuses `payment.gatewayOrderId` if set, else `createOrder({ amountPaise: totals.payablePaise, receipt: order.number, notes: { orderId } })` and `updateOne({ _id, "payment.gatewayOrderId": null }, { $set })` (when that matches nothing, re-read and use the stored id). `type GatewayHandoff = { gatewayOrderId: string; amountPaise: number; keyId: string; number: string }`.
  - `placeOrder` calls `ensureGatewayOrder` after the commit for prepaid; a gateway failure still returns the order (the client retries through `/pay`, Task O10).

- [ ] **Step 1: Write the failing tests** (`tests/int/order-place.test.ts`, clock `2026-11-27T06:00:00Z`, the cart filled through `addToCart`)
  - COD happy path: `sacuwin-100` × 2 with an approved valid Rx → `status "placed"`, `number` matches `^AAR-2611-\d{5}$`, `totals.payablePaise` 77400, `lines[0].unitPaise` 38700, the cart is empty with `rev` + 1, one `order.place` audit row whose `meta` has no address or patient field.
  - **Review Focus 1:** the same input again (after the cart was cleared) → `{ ok: true, replay: true }` with the same `number`; two parallel calls → one order document.
  - **Review Focus 4:** `cartRev` stale → `cart_changed` with `cart`; a raw `updateOne` setting `mrpPaise` to 41700 → `price_changed`, `cart.totals.payablePaise` 79400; `active: false` on the product → `cart_changed`; nothing inserted in any case.
  - **Review Focus 5:** another user's `addressId` → `address_not_found`; another user's `rxId` → `rx_not_found`; a rejected Rx → `rx_rejected`; an approved Rx whose 6 months ended one hour ago → `rx_expired`; a pending Rx → ok; `rxId: null` with an Rx line → `rx_required`.
  - COD over the cap: 10 × `bemptor-r40` (payable 610,000) → `cod_limit`; a test product inserted with `mrpPaise: 52000` × 10 (payable exactly 500,000) → placed.
  - Prepaid with `onlinePaymentsEnabled()` false → `online_payments_disabled`. With `ONLINE_PAYMENTS_PREVIEW=1` → `status "pending_payment"`, the cart **kept**, `payment.gatewayOrderId` set by the fake; with the fake's `createOrder` stubbed to throw → still ok, `gatewayOrderId: null`.
  - An empty cart → `cart_empty`.
- [ ] **Step 2: Run** `pnpm exec vitest run --project int tests/int/order-place.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** it (expected: PASS), then the full local check.
- [ ] **Step 5: Commit** `feat(orders): place orders priced on the server, idempotently`.

### Task O7: Customer order views and the checkout model (PR `feat/order-views`)

**Depends on:** O2, O3; R1 (`rxView`, on `main`).

**Files:**
- Create: `src/server/orders/view.ts`, `src/server/orders/view.test.ts`, `src/server/orders/checkout.ts`, `tests/int/checkout-model.test.ts`.
- Modify: `docs/dev/architecture.md`, `CHANGELOG.md`.

**Interfaces:**
- Consumes: O1 `paymentOptions`, `canCustomerCancel`, `rxNeeded`, `rxUsableAt`; O2 `OrderDoc`, `listOrdersForUser`; O3 `listAddresses`; O6 `onlinePaymentsEnabled`; K2 `getCart`, `readCart`; R4 `listRxForUser`; R1 `rxView`, `RxListItem`.
- Produces (`view.ts`, pure):
  - `type TimelineStep = { key: "placed" | "rx" | "confirmed" | "packed" | "shipped" | "delivered" | "cancelled"; state: "done" | "current" | "todo" | "bad"; at: string | null; rx?: "under_review" | "approved" | "rejected"; shipment?: { courier: string; trackingUrl: string | null } }`.
  - `orderTimeline(order: OrderDoc, rx: RxListItem | null): TimelineStep[]`: placed (done at `createdAt`, or `current` while `pending_payment`); rx (`current` with `under_review` until confirmed; `bad` with `rejected` when on hold; `done` with `approved` once confirmed); confirmed, packed, shipped (with the shipment), delivered from history; a cancelled order ends at a `cancelled` step marked `bad` and drops the later steps.
  - `type OrderView = { number; status; placedAt: string; lines: OrderLine[]; totals: CartTotals; payment: { method; status }; address: AddressSnapshot; rx: RxListItem | null; timeline: TimelineStep[]; canCancel: boolean; canPay: boolean; cancel: { reason; note } | null }`; `toOrderView(order, rx: RxListItem | null, now: Date, onlineEnabled: boolean): OrderView` (`canPay` = prepaid, `pending_payment`, online enabled).
  - `type OrderSummary = { number; status; placedAt; itemsLabel: string /* "Sacuwin 100 × 2, Hyloage Eye Drops × 1" */; packs: number; payablePaise: number }`; `toOrderSummary(order)`.
- Produces (`checkout.ts`):
  - `type CheckoutRxOption = RxListItem & { usable: boolean }` (`usable` = `rxUsableAt` is ok at `now`).
  - `type CheckoutPastRx = { orderNumber: string; orderedAt: string; itemsLabel: string; rx: CheckoutRxOption }` (one per distinct `rxId`, newest 5).
  - `type CheckoutView = { cart: CartView; cartRev: number; addresses: AddressView[]; rx: { needed: boolean; saved: CheckoutRxOption[]; past: CheckoutPastRx[] }; payment: { onlineEnabled: boolean; codLimitPaise: number; cod: { allowed: boolean; reason: "over_limit" | null } }; keyId: string | null }`.
  - `getCheckout(user: UserDoc, now: Date): Promise<CheckoutView>`: `getCart` first (it may prune), then `readCart` for `cartRev` (0 for no cart).

- [ ] **Step 1: Write the failing tests**
  - `view.test.ts`: a placed COD order with a pending Rx → steps `placed done`, `rx current under_review`, the rest `todo`; on hold → rx `bad rejected`; shipped with `{ courier: "Delhivery", trackingUrl }` → shipped `done` carrying it; cancelled from confirmed → the last step `cancelled bad`, no packed/shipped/delivered steps; `canCancel` false at packed; `toOrderSummary` label for two lines matches the prototype's form.
  - `tests/int/checkout-model.test.ts`: saved list marks an expired approved Rx and a rejected Rx `usable: false` and a pending one `usable: true`; a past order's Rx appears once even if two orders used it; `payment.cod.allowed` false over 500,000; `keyId` is `"fake"` with the fake; another user's Rx never appears.
- [ ] **Step 2: Run** `pnpm exec vitest run --project unit src/server/orders/view.test.ts && pnpm exec vitest run --project int tests/int/checkout-model.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** it (expected: PASS), then the full local check.
- [ ] **Step 5: Commit** `feat(orders): add the customer order views and the checkout model`.

### Task O8: Checkout and place-order routes (PR `feat/orders-place-route`)

**Depends on:** O6, O7.

**Files:**
- Create: `src/app/api/checkout/route.ts`, `src/app/api/orders/route.ts` (POST here; GET in O11), `src/server/orders/http.ts`, `tests/int/orders-place-route.test.ts`.
- Modify: `docs/dev/architecture.md` (route bullets, rate-limit keys), `CHANGELOG.md`.

**Interfaces:**
- Consumes: O6 `placeOrder`, `PlaceOrderInput`; O7 `getCheckout`, `toOrderView`; `requireUser`, `sessionRefreshHeaders`, `hitRateLimit`, `readJson`, `withErrors`, `assertSameOrigin`.
- Produces:
  - `src/server/orders/http.ts`: `limitOrders(auth, kind: "place" | "mutate", now)` (`orders-place:user:<id>` 20 per hour; `orders:user:<id>` 60 per hour; 429 `rate_limited` with `Retry-After`), `numberParam(ctx)` (`^AAR-\d{4}-\d{5,}$`, else 404 `not_found`), `orderErrorResponse`.
  - `GET /api/checkout` → 200 `CheckoutView` | 401.
  - `POST /api/orders` (`PlaceOrderInput`) → 201 `{ order: OrderView, payment: GatewayHandoff | null }` (new) | 200 the same shape (`replay`) | 409 `{ error: PlaceError, cart? }` | 400 | 401 | 403 | 429.

- [ ] **Step 1: Write the failing tests** (`tests/int/orders-place-route.test.ts`, calling the handlers)
  - GET checkout signed in → 200 with `cartRev` and `cache-control: no-store`; no cookie → 401.
  - POST COD → 201, `order.number`, `payment: null`; the same body again → 200 with the same number. **Review Focus 1:** two parallel POSTs with one key → one `orders` document, both bodies carry the same `number`.
  - Stale `cartRev` → 409 `{ error: "cart_changed", cart }`; no Origin → 403; `method: "upi"` → 400; the 21st placement within an hour → 429 with `Retry-After`.
  - Prepaid with the preview flag → 201 with `payment.keyId "fake"` and `amountPaise` equal to `order.totals.payablePaise`.
  - The session slid: the response carries `Set-Cookie`.
  - A console spy sees no address or patient name.
- [ ] **Step 2: Run** `pnpm exec vitest run --project int tests/int/orders-place-route.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** thin handlers (Origin → `requireUser` → limit → `readJson` → service → `jsonResponse` with the refresh headers).
- [ ] **Step 4: Run** it (expected: PASS), `pnpm exec vitest run --project unit src/server/route-config.test.ts`, then the full local check.
- [ ] **Step 5: Commit** `feat(orders): add the checkout and place-order routes`.

### Task O9: Refunds (PR `feat/order-refunds`)

**Depends on:** O2, O4.

**Files:**
- Create: `src/server/orders/refunds.ts`, `tests/int/order-refunds.test.ts`.
- Modify: `docs/dev/architecture.md`, `CHANGELOG.md`.

**Interfaces:**
- Consumes: O2 `OrderDoc`, `appendAudit`; O4 `PaymentGateway.refund`, `fetchRefund`, `GatewayError`.
- Produces:
  - `REFUND_CLAIM_MS = 300_000`; `refundReceipt(number) = "rf_" + number`.
  - `executeRefund(orderId: ObjectId, now: Date): Promise<"requested" | "processed" | "not_due" | "busy" | "failed">`:
    1. claim: `findOneAndUpdate({ _id, status: "cancelled", "payment.status": "refund_pending", "payment.paymentId": { $type: "string" }, "payment.refund.id": null, $or: [{ "payment.refund.claimUntil": null }, { "payment.refund.claimUntil": { $lte: now } }] }, { $set: { "payment.refund.claimUntil": now + 5 min } })` (`payment.refund` exists because every write that sets `refund_pending` initialises it, Task O2 and Task O10);
    2. no match: `not_due` when the order is not a due refund, else `busy`;
    3. `gateway.refund({ paymentId, amountPaise: totals.payablePaise, receipt })`;
    4. success: `$set refund.id, requestedAt, claimUntil: null` and audit `payment.refund_requested` (meta `{ amountPaise }`); a `processed` answer also sets `payment.status "refunded"`, `processedAt`, audit `payment.refunded` → `processed`, else `requested`;
    5. a `GatewayError`: release the claim, log the error name, return `failed`.
  - `markRefundProcessed(i: { paymentId: string; refundId: string; now: Date }): Promise<boolean>`: conditional on `payment.status "refund_pending"` and the matching `refund.id`; sets `refunded` and writes `payment.refunded`.
  - `releaseFailedRefund(i: { paymentId: string; refundId: string; now: Date }): Promise<boolean>`: clears `refund.id` so a later `executeRefund` can retry.

- [ ] **Step 1: Write the failing tests** (`tests/int/order-refunds.test.ts`, with `seedOrder` cancelled, prepaid, `refund_pending`, `paymentId` from the fake)
  - `executeRefund` → `requested`; the fake holds one refund with receipt `rf_<number>`; a second call → `not_due`.
  - Three parallel calls → one `requested`, the rest `busy` or `not_due`; the fake holds one refund.
  - A gateway that throws `unavailable` → `failed`, the claim released, `refund.id` null; a retry after that → `requested`.
  - An `on_hold` `refund_pending` order → `not_due` (F16 deferral).
  - `markRefundProcessed` → `refunded`, one `payment.refunded` row; again → false.
- [ ] **Step 2: Run** `pnpm exec vitest run --project int tests/int/order-refunds.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** it (expected: PASS), then the full local check.
- [ ] **Step 5: Commit** `feat(orders): add claimed, idempotent refunds`.

### Task O10: Payment capture, checkout verify and pay-again (PR `feat/payment-verify`)

**Depends on:** O6, O9.

**Files:**
- Create: `src/server/orders/payment.ts`, `src/app/api/payments/verify/route.ts`, `src/app/api/orders/[number]/pay/route.ts`, `tests/int/payment-capture.test.ts`.
- Modify: `docs/dev/architecture.md`, `CHANGELOG.md`.

**Interfaces:**
- Consumes: O2 `applyTransition`, `findOrderForUser`, `withTransaction`; O6 `clearCart`, `ensureGatewayOrder`; O9 `executeRefund`; O4 gateway.
- Produces:
  - `capturePayment(i: { order: OrderDoc; paymentId: string; source: "checkout" | "webhook" | "reconcile"; now: Date }): Promise<"placed" | "already" | "refunding" | "mismatch" | "not_captured">`:
    - `fetchPayment(paymentId)`; `not_captured` unless `status === "captured"`;
    - `mismatch` (audit `payment.mismatch`, meta `{ source, amountPaise, expectedPaise }`, nothing else written) unless `payment.orderId === order.payment.gatewayOrderId` and `amountPaise === order.totals.payablePaise`;
    - order `pending_payment`: in one `withTransaction`, `applyTransition(payment_captured, by "system", set { "payment.status": "paid", "payment.paymentId", "payment.paidAt": now })`, `clearCart(userId, order.cartRev)` (false is fine), audit `payment.paid` (meta `{ source, amountPaise }`) → `placed`; a `conflict` → re-read and continue with the branches below;
    - order already holding this `paymentId` → `already`;
    - order `cancelled` without a `paymentId`: conditional `$set { "payment.status": "refund_pending", "payment.paymentId", "payment.refund": { …nulls } }` on `{ _id, "payment.paymentId": null }`, then `executeRefund` → `refunding` (a lost race → `already`).
  - `VerifyBody = z.strictObject({ number: z.string().regex(/^AAR-\d{4}-\d{5,}$/), gatewayOrderId: id64, paymentId: id64, signature: z.string().regex(/^[0-9a-f]{64}$/) })`, `id64 = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/)`.
  - `verifyCheckoutPayment(i: { user: UserDoc; body: VerifyBody; now: Date }): Promise<{ ok: true; order: OrderDoc } | { ok: false; error: "not_found" | "bad_signature" | "payment_not_captured" | "payment_mismatch" }>`: `findOrderForUser`; the body's `gatewayOrderId` must equal the order's (else `bad_signature`); `verifyPaymentSignature` (timing-safe, inside the gateway); then `capturePayment(source "checkout")`.
  - `POST /api/payments/verify` (`VerifyBody`) → 200 `{ order: OrderView }` | 400 `bad_signature` | 404 | 409 `payment_not_captured` / `payment_mismatch` | 401 | 403 | 429 (`orders:user`).
  - `POST /api/orders/[number]/pay` → 200 `GatewayHandoff` | 409 `not_payable` (not prepaid `pending_payment`, or online disabled) | 503 `gateway_unavailable` | 404 | 401 | 403 | 429.

- [ ] **Step 1: Write the failing tests** (`tests/int/payment-capture.test.ts`; prepaid orders placed through `placeOrder` with the preview flag; payments through `simulateFakePayment`)
  - Verify with the right signature → 200, `status "placed"`, `payment.status "paid"`, the cart cleared; with the cart edited after placement (rev moved) → placed and the cart kept.
  - A flipped signature character → 400 `bad_signature`, nothing written; another user's order number → 404.
  - **Review Focus 2:** three parallel `capturePayment` calls (checkout, webhook, reconcile) → one `placed`, two `already`; one `payment_captured` history entry and one `payment.paid` row.
  - **Review Focus 3:** cancel the order by system first, then `capturePayment` → `refunding`, `payment.status "refund_pending"`, the fake holds one refund; a second `capturePayment` → `already`, still one refund.
  - A `failed` payment → `not_captured`; an amount 100 paise short (fake `amountPaise` override) → `mismatch` with one `payment.mismatch` row and status unchanged.
  - `/pay` on a pending order → the same `gatewayOrderId` as placement; on a COD order → 409 `not_payable`.
- [ ] **Step 2: Run** `pnpm exec vitest run --project int tests/int/payment-capture.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** it (expected: PASS), then the full local check.
- [ ] **Step 5: Commit** `feat(payments): capture payments idempotently and verify checkout callbacks`.

  Split seam if over 400 lines: the `/pay` route in its own PR.

### Task O11: Order history, detail, cancel and re-order routes (PR `feat/orders-customer-api`)

**Depends on:** O7, O8, O9.

**Files:**
- Create: `src/server/orders/customer.ts`, `src/app/api/orders/[number]/route.ts`, `src/app/api/orders/[number]/cancel/route.ts`, `src/app/api/orders/[number]/reorder/route.ts`, `tests/int/orders-customer.test.ts`.
- Modify: `src/app/api/orders/route.ts` (add GET), `docs/dev/architecture.md`, `CHANGELOG.md`.

**Interfaces:**
- Consumes: O1 `CANCEL_REASONS`, `CANCEL_NOTE_MAX`; O2 `applyTransition`, `findOrderForUser`, `listOrdersForUser`; O7 `toOrderView`, `toOrderSummary`; O9 `executeRefund`; K2 `mergeGuestCart`; R4 `getRxForUser` and R1 `rxView` for the order's Rx.
- Produces:
  - `CancelBody = z.strictObject({ reason: z.enum(CANCEL_REASONS), note: plainText(0, CANCEL_NOTE_MAX).optional() })` (`plainText` from Task O3).
  - `cancelOrderByCustomer(i: { user; number; body: CancelBody; now }): Promise<{ ok: true; order: OrderDoc } | { ok: false; error: "not_found" | "not_cancellable" | "conflict" }>`: `applyTransition(cancel, by "customer", reason = body.reason, set { cancel: { reason, note, by: "customer" } })`; an `invalid_transition` is `not_cancellable`; a `refund` effect → `executeRefund` after the commit (a failure is left for the cron).
  - `reorder(i: { user; number; now }): Promise<{ ok: true; cart: CartView & { trimmed: boolean } } | { ok: false; error: "not_found" }>`: `mergeGuestCart(userId, order.lines.map(({ slug, qty }) => ({ slug, qty })), now)`.
  - `GET /api/orders` → 200 `{ orders: OrderSummary[] }` | 401. `GET /api/orders/[number]` → 200 `{ order: OrderView }` | 404 `not_found` (missing, malformed and another user's alike) | 401. `POST …/cancel` → 200 `{ order }` | 409 `not_cancellable` | 404 | 400. `POST …/reorder` → 200 `CartView & { trimmed }` | 404. Mutations: Origin, `orders:user` limit, refresh headers.

- [ ] **Step 1: Write the failing tests** (`tests/int/orders-customer.test.ts`)
  - List: newest first; another user's orders absent. Detail: `timeline` present; `rx` is the order's Rx view.
  - **Review Focus 5:** user B GETs user A's number → 404 `{ error: "not_found" }`; `"AAR-1"` → the same body; B cancels A's order → 404, A's order unchanged.
  - Cancel a placed COD order with `{ reason: "change_address" }` → `cancelled`, `cancel.by "customer"`, history reason `change_address`. Cancel at packed → 409 `not_cancellable`. Cancel a paid prepaid order → `cancelled`, a fake refund with receipt `rf_<number>`. A 501-character note → 400.
  - Re-order twice in parallel → the cart equals one re-order (max per slug); a retired product → listed in `removed`.
  - A console spy sees no cancel note.
- [ ] **Step 2: Run** `pnpm exec vitest run --project int tests/int/orders-customer.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** it (expected: PASS), `pnpm exec vitest run --project unit src/server/route-config.test.ts`, then the full local check.
- [ ] **Step 5: Commit** `feat(orders): add order history, detail, cancel and re-order routes`.

### Task O12: Razorpay webhook with dedupe (PR `feat/payment-webhook`)

**Depends on:** O10.

**Files:**
- Create: `src/server/payments/webhook-events.ts`, `src/server/payments/webhook.ts`, `src/app/api/payments/webhook/route.ts`, `tests/int/payment-webhook.test.ts`.
- Modify: `src/server/http.ts` (use R5's exported `readCappedBytes(req, max)`; if R5 has not merged, export it here with R5's signature and R5 drops its copy), `src/server/db/register-all.ts`, `docs/dev/architecture.md` (`webhook_events` row), `CHANGELOG.md`.

**Interfaces:**
- Consumes: O10 `capturePayment`; O9 `markRefundProcessed`, `releaseFailedRefund`; O2 `findOrderByGatewayOrderId`, `appendAudit`; O4 `verifyWebhookSignature`.
- Produces:
  - `WEBHOOK_EVENTS_COLLECTION = "webhook_events"`; doc `{ _id: string; event: string; status: "processing" | "done" | "failed"; claimedAt: Date; processedAt: Date | null; receivedAt: Date }`; index `receivedAt_ttl` (`expireAfterSeconds: 7_776_000`).
  - `claimEvent(id, event, now): Promise<"claimed" | "duplicate" | "in_progress">`: insert; on E11000, a `done` row → `duplicate`; a `processing` row claimed within 5 minutes → `in_progress`; else a conditional takeover → `claimed`.
  - `finishEvent(id, status: "done" | "failed", now)`.
  - `handleRazorpayEvent(payload: unknown, now): Promise<void>`: a zod `discriminatedUnion` on `event` reading only ids (`payload.payment.entity.id`, `.order_id`; `payload.refund.entity.id`, `.payment_id`); an unknown event is a no-op.
  - `POST /api/payments/webhook`: raw body ≤ 64 KiB (413), `x-razorpay-signature` must verify against the raw text (400 `bad_signature`), event id from `x-razorpay-event-id` (`^[A-Za-z0-9_-]{1,64}$`) else SHA-256 of the body; `claimEvent` → `duplicate` 200 `{ ok: true, duplicate: true }`, `in_progress` 409; handle; `finishEvent("done")` → 200; a thrown error → `finishEvent("failed")` → 500 (Razorpay retries). No Origin check, no session, no body or header value logged.

- [ ] **Step 1: Write the failing tests** (`tests/int/payment-webhook.test.ts`; bodies signed with `signFakeWebhook`)
  - `payment.captured` for a pending prepaid order → 200, the order `placed`, one `webhook_events` row `done`.
  - The same event id again → 200 `duplicate`, no second history entry; while the first is `processing` (claimed 1 minute ago) → 409; claimed 6 minutes ago → reprocessed.
  - A signature over a re-serialised body → 400; a 65 KiB body → 413.
  - `refund.processed` → the order `refunded`; `refund.failed` → `refund.id` null.
  - An unknown event `payout.processed` → 200 and stored `done`.
  - A handler that throws (stub `capturePayment`) → 500 and the row `failed`; the next delivery → 200.
  - A console spy sees no body text and no signature.
- [ ] **Step 2: Run** `pnpm exec vitest run --project int tests/int/payment-webhook.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** it (expected: PASS), then the full local check.
- [ ] **Step 5: Commit** `feat(payments): add the Razorpay webhook with event dedupe`.

### Task O13: Reconcile cron (PR `feat/reconcile-cron`)

**Depends on:** O9, O10.

**Files:**
- Create: `src/server/orders/reconcile.ts`, `src/app/api/cron/reconcile/route.ts`, `vercel.json`, `tests/int/reconcile.test.ts`.
- Modify: `src/server/env.ts` (`CRON_SECRET`, optional, at least 32 characters), `.env.example`, `docs/dev/deploy.md` (cron, Pro plan, `CRON_SECRET` per scope), `docs/decisions/environments.md`, `docs/dev/architecture.md`, `CHANGELOG.md`.

**Interfaces:**
- Consumes: O1 timers; O2 `applyTransition`; O9 `executeRefund`, `markRefundProcessed`; O10 `capturePayment`; O4 `fetchOrderPayments`, `fetchRefund`.
- Produces:
  - `reconcile(now: Date): Promise<{ captured: number; expired: number; refunded: number; polled: number; holdsCancelled: number }>`, steps in this order, each a query on `status_updatedAt` (or `createdAt`), oldest first, `limit(50)`:
    1. `pending_payment` with a `gatewayOrderId` and `createdAt ≤ now − 15 min`: a captured payment in `fetchOrderPayments` → `capturePayment(source "reconcile")`;
    2. `pending_payment` with `createdAt ≤ now − 60 min` and still unpaid → `applyTransition(cancel, by "system", reason "payment_not_completed", set { cancel })`;
    3. `cancelled`, `refund_pending`, `refund.id: null` → `executeRefund`;
    4. `refund_pending` with `refund.requestedAt ≤ now − 1 h` → `fetchRefund`; `processed` → `markRefundProcessed`;
    5. `on_hold` whose last history entry is older than 7 days → `cancel` by system, reason `prescription_not_approved`, then `executeRefund` when the effect says so.
    A step's gateway error is logged by name and skips that order.
  - `GET /api/cron/reconcile`: `await connection()`; `Authorization` must equal `Bearer <CRON_SECRET>` (timing-safe; a missing secret → 500 `server_misconfigured`; a wrong header → 401 `unauthorized`); → 200 the counts.
  - `vercel.json`: `{ "crons": [{ "path": "/api/cron/reconcile", "schedule": "*/10 * * * *" }] }` (merge with any keys already there).

- [ ] **Step 1: Write the failing tests** (`tests/int/reconcile.test.ts`, clock-driven)
  - A prepaid order 16 minutes old with a captured fake payment → `captured: 1`, `placed`.
  - One 61 minutes old with none → `expired: 1`, `cancelled` with `cancel.reason "payment_not_completed"`; 59 minutes → untouched.
  - A cancelled `refund_pending` order whose first refund failed → `refunded: 1` on the next run.
  - An on-hold prepaid paid order held 7 days + 1 minute → `cancelled`, a fake refund; 6 days → untouched.
  - Running `reconcile` twice in parallel changes nothing more than once (one history entry per order).
  - Route: no header → 401; the right Bearer → 200 with counts; `CRON_SECRET` unset → 500.
- [ ] **Step 2: Run** `pnpm exec vitest run --project int tests/int/reconcile.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** it (expected: PASS), `pnpm exec vitest run --project unit src/server/route-config.test.ts`, then the full local check.
- [ ] **Step 5: Commit** `feat(orders): add the reconcile cron`.

### Task O14: Checkout shell, reduced header and stepper (PR `feat/checkout-shell`)

**Depends on:** O8; K6 (`ROUTES.checkout`, `/checkout` in `PENDING_ROUTES`, `OperateShell`), K5 (`CartSummary`, `CartLineItem`).

**Files:**
- Create: `src/app/(checkout)/layout.tsx`, `src/app/(checkout)/checkout/page.tsx`, `src/components/checkout/{reduced-header.tsx,checkout-copy.ts,checkout-api.ts,checkout-api.test.ts,stepper.ts,stepper.test.ts,checkout-page.tsx,checkout-page.test.tsx}`, `src/styles/checkout.css`.
- Modify: `src/app/globals.css` [C16], `docs/dev/architecture.md`, `CHANGELOG.md`.

**Interfaces:**
- Consumes: O8 routes (types via `import type`); K5 `CartSummary`, `CartLineItem variant="compact"`; `StoreFooter` (the footer component inside `withStoreChrome`); `openLogin`; `announce`.
- Produces:
  - `(checkout)/layout.tsx`: skip link, `ReducedHeader` (`header.store-head.store-head--reduced`: the logo link home and `p.sh-secure` "Secure checkout"), `children`, the store footer. No announcement bar, no category bar, no search.
  - `/checkout` page: static, `metadata = { title: "Checkout", robots: { index: false } }`, the band ("Back to cart" → `ROUTES.cart`, h1 "Checkout", `ol.prog` with the four labels "Address", "Prescription", "Payment", "Review"), then `<CheckoutPage/>`.
  - `checkout-api.ts` (nothing throws, 15 s timeout, like `src/lib/cart/api.ts`): `getCheckout()`, `addAddress(input)`, `placeOrder(input)`, `verifyPayment(body)`, `payOrder(number)`, each returning `{ ok: true; … } | { ok: false; error: string; cart?: CartView; retryAfterSec?: number }`; anything unexpected is `network`.
  - `stepper.ts` (pure): `type Step = 1 | 2 | 3 | 4`; `type CheckoutState = { step: Step; done: ReadonlySet<Step>; addressId: string | null; rxId: string | null; method: "cod" | "prepaid" | null }`; `checkoutReducer(state, action)` with actions `choose_address`, `choose_rx`, `choose_method`, `next`, `goto(step)` (only to a done step or the current one) and `reset_after(step)` (a change to an earlier step clears the later choices). When `rx.needed` is false, step 2 is skipped and shown done with "No prescription needed" (awaiting owner approval).
  - `CheckoutPage` (client): loads `getCheckout()` after hydration; `401` → a sign-in panel whose button calls `openLogin(ROUTES.checkout)`; an empty cart → `EmptyState` "Your cart is empty" with a link to `ROUTES.cart`; else `.co-grid` with the steps column (O15–O17 fill it) and the aside `details.co-sum` ("Order summary", packs, compact lines, `CartSummary full`, "Edit cart" → `ROUTES.cart`). Moving to a step focuses its `h2[tabindex=-1]`.
  - `checkout.css`: port from `flows.css` the rules for `.band*` (if not already ported), `.prog*`, `.co-grid`, `.co-steps`, `.co-aside`, `.co-sum*`, `.cstep*`, `.seg*`, `.opts`, `.opt*`, `.opt-add`, `.addr-form`, `.form-grid`, `.review*`, `.place*`, and from `store.css` `.store-head--reduced` and `.sh-secure`, with [C13] fixes.

- [ ] **Step 1: Write the failing tests**
  - `stepper.test.ts`: `goto(3)` before step 2 is done is ignored; changing the address after reaching step 4 clears `rxId` and `method` and returns to step 2; `rx.needed false` skips step 2.
  - `checkout-api.test.ts` (mocked `fetch`): 409 `{ error: "price_changed", cart }` → `{ ok: false, error: "price_changed", cart }`; a timeout → `network`.
  - `checkout-page.test.tsx`: unauthenticated → the sign-in panel; empty cart → the empty state; with a view → the steps and the summary with "Total payable"; the header has "Secure checkout" and no search box; `findClaims(text)` is `[]`.
- [ ] **Step 2: Run** `pnpm exec vitest run --project ui src/components/checkout && pnpm exec vitest run --project unit src/styles`. Expected: FAIL.
- [ ] **Step 3: Implement.** `/checkout` stays in `PENDING_ROUTES` until O17.
- [ ] **Step 4: Run** it (expected: PASS) and the full local check. **Visual:** `node scripts/shoot.mjs http://localhost:3341/checkout .impeccable/review/checkout 1440,390` against `design/prototype/pages/checkout.html?state=checkout`; list mismatches of the header, band, stepper and aside.
- [ ] **Step 5: Commit** `feat(checkout): add the checkout shell, reduced header and stepper`.

  Split seam if over 400 lines: `checkout.css` + the layout and header in a first PR.

### Task O15: Address step (PR `feat/checkout-address`)

**Depends on:** O14, O3.

**Files:**
- Create: `src/components/checkout/address-step.tsx`, `address-form.tsx`, `address-step.test.tsx`.
- Modify: `src/components/checkout/checkout-copy.ts`, `checkout-page.tsx`, `CHANGELOG.md`.

**Interfaces:**
- Consumes: O14 reducer and `addAddress`; `TextField`, `Select`, `Checkbox`, `ErrorSummary`, `Button`; `INDIAN_STATES` from `src/lib/india-states.ts` (Task O3); the `AddressInput` limits mirrored client-side (the server stays the authority).
- Produces: `AddressStep({ addresses, onChosen(id), onAdded(view) })`: `fieldset.opts.opts--2` of saved addresses (default preselected), "Add a new address" (`button.opt-add[aria-expanded]`), the form with the prototype's labels, autocomplete tokens and messages verbatim (`Full name`, `Mobile number` with the `+91` prefix, `Flat, house no., building`, `Area, street, sector`, `Landmark (optional)`, `Pincode` with the hint "Delivery is free to any valid pincode in India.", `City or town`, `State or union territory`, "Make this my default address", "Save and deliver here", "Cancel"), and "Deliver to this address". A 409 `address_limit` shows "You have 10 saved addresses, the most we keep. Choose one of them." (awaiting owner approval). The step summary is "<name>, <line1>, <city> <pincode>".

- [ ] **Step 1: Write the failing tests** (`address-step.test.tsx`): no saved address → the form open; submitting empty → one focused `ErrorSummary` listing every required field, `errorAlert={false}` on each; a mobile "51234 56789" → the mobile error only, on the field; a valid submit calls `addAddress` and advances; with two saved, the default is checked and "Deliver to this address" advances with its id; `findClaims` is `[]`.
- [ ] **Step 2: Run** `pnpm exec vitest run --project ui src/components/checkout/address-step.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** it (expected: PASS) and the full local check. **Visual** against `checkout.html?state=checkout` and `?state=checkout-errors`.
- [ ] **Step 5: Commit** `feat(checkout): add the address step`.

### Task O16: Prescription step (PR `feat/checkout-rx`)

**Depends on:** O15; R6 (`RxUploadForm`, `RX_COPY`), R7 (`formatIstDay` in `rx-copy.ts`).

**Files:**
- Create: `src/components/checkout/rx-step.tsx`, `rx-step.test.tsx`.
- Modify: `checkout-copy.ts`, `checkout-page.tsx`, `CHANGELOG.md`.

**Interfaces:**
- Consumes: O7 `CheckoutView["rx"]`; R6 `RxUploadForm({ onUploaded(item: RxListItem), onCancel() })`; R7 `formatIstDay(ymd)`.
- Produces: `RxStep({ rx, rxLines, onChosen(rxId), onUploaded(item) })`:
  - the lede "Your order has <b>N prescription medicine(s)</b>: <names>. A pharmacist checks that the prescription covers each one before we pack." (prototype);
  - `fieldset.seg` "Saved" / "Upload new" / "Past order" (the "Past order" option only when `past` is non-empty; "Saved" only when `saved` is non-empty, else "Upload new" is preselected);
  - Saved: `label.opt.opt-rx` per item, title = patient name, text "Photo · uploaded <d MMM yyyy>" or "PDF · N pages · uploaded …" (no file name, by the R ruling), a status tag ("Approved · valid until <day>", "Under review", "Expired on <day>", "Rejected"); an unusable item is `disabled` with `aria-describedby` to `.opt-why` ("Prescriptions stay valid for 6 months from their date." for expired; "The pharmacist couldn’t accept this prescription." for rejected; awaiting owner approval where the prototype's text is cut);
  - Upload new: `RxUploadForm`; `onUploaded` adds the item to Saved, selects it and announces;
  - Past order: "From order <mono>AAR-…</mono>", "<patient> · <items> · ordered <day>" and the tag;
  - "Use this prescription" advances with the chosen `rxId`.

- [ ] **Step 1: Write the failing tests** (`rx-step.test.tsx`, `RxUploadForm` mocked): an expired item is disabled and described; selecting a pending item and continuing sends its id; an `onUploaded` item becomes checked and the live region speaks it; with no saved and no past, only the upload panel shows; no `output` or `[aria-live]` in the DOM; `findClaims` is `[]`.
- [ ] **Step 2: Run** `pnpm exec vitest run --project ui src/components/checkout/rx-step.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** it (expected: PASS) and the full local check. **Visual** against `checkout.html?state=checkout-step-2` and `?state=checkout-upload`.
- [ ] **Step 5: Commit** `feat(checkout): add the prescription step`.

### Task O17: Payment, review and place, with the fake pay page (PR `feat/checkout-place`)

**Depends on:** O16, O10.

**Files:**
- Create: `src/components/checkout/payment-step.tsx`, `review-step.tsx`, `pay-online.ts`, `payment-step.test.tsx`, `review-step.test.tsx`, `pay-online.test.ts`, `src/app/dev/pay/[id]/page.tsx`, `src/app/dev/pay/route.ts`.
- Modify: `checkout-copy.ts`, `checkout-page.tsx`, `src/config/routes.ts` (remove `/checkout` from `PENDING_ROUTES`; add `ROUTES.order(number)` = `/order/${number}` to `PENDING_ROUTES` as `/order/AAR-0000-00000`), `src/config/routes.test.ts`, `e2e/helpers/pages.ts` (`START` gains `/checkout`), `CHANGELOG.md`.

**Interfaces:**
- Consumes: O14 API and reducer; O8 `GatewayHandoff`; O10 verify; O4 `simulateFakePayment` (dev route only).
- Produces:
  - `PaymentStep({ payment, payablePaise, onChosen(method) })`: with `onlineEnabled`, the prototype's online option and its refund line; COD with its hint; COD over the limit is disabled with "Not available for this order: its total is <₹X>, above the ₹5,000 limit. Pay online, or remove some packs." Without `onlineEnabled`: COD only; over the limit the step shows "Cash on delivery is available for orders up to ₹5,000. This order is <₹X>; remove some packs to place it." (awaiting owner approval) and no Continue; no UPI, card or refund word anywhere.
  - `ReviewStep({ view, state, onPlaced })`: `dl.review` rows "Deliver to", "Prescription", "Payment", each with "Change"; "Total payable" with "Inclusive of all taxes · free delivery"; "Place order"; the note "We confirm your order once a pharmacist has checked your prescription against this order." plus, only when `onlineEnabled`, " If it can’t be approved, we cancel the order and refund anything you paid." On click: the idempotency key from `aarv-checkout-v1` (the ruling), `placeOrder`; `price_changed` → an inline note "The total changed to <₹X> because a price was updated. Check it and place the order again." (awaiting owner approval), the summary updated, the button re-enabled; `cart_changed` → reload the view and return to the first step whose choice is invalid; Rx errors → back to step 2 with the error; one submit in flight; success COD → `cartStore.signIn()` (K4; re-reads the now-empty server cart) and `router.push(ROUTES.order(number))`.
  - `payOnline(handoff, order): Promise<"paid" | "dismissed" | "failed">` in `pay-online.ts`: `keyId === "fake"` → `location.assign("/dev/pay/<gatewayOrderId>?number=<n>")`; else inject Checkout.js once and open it with `{ key, order_id, amount, currency: "INR", name: "Aarvion Pharmaceuticals", handler }`, whose handler calls `verifyPayment` and then navigates to the order page; dismiss → the order page, where "Pay now" retries.
  - `/dev/pay/[id]` (dev only, `requireDevRoute()`): "Test payment", the amount, "Pay" and "Fail" buttons; `POST /dev/pay { gatewayOrderId, outcome }` (dev only, Origin) → `simulateFakePayment` → `{ paymentId, signature }`; the page then posts `verifyPayment` and goes to `/order/<number>`.

- [ ] **Step 1: Write the failing tests**
  - `payment-step.test.tsx`: `onlineEnabled false`, payable 477,400 → COD only and no "UPI", "card" or "refund" in the text; payable 600,000 → the limit sentence, no Continue; `onlineEnabled true`, 600,000 → COD disabled with the prototype sentence.
  - `review-step.test.tsx`: two quick clicks → one `placeOrder` call; a reload with the same `cartRev` reuses the stored key; a `price_changed` result shows the new total and keeps the button enabled.
  - `pay-online.test.ts`: `keyId "fake"` assigns the dev URL; another key injects one `script[src="https://checkout.razorpay.com/v1/checkout.js"]` even when called twice.
  - `routes.test.ts`: `PENDING_ROUTES` has no `/checkout`.
- [ ] **Step 2: Run** `pnpm exec vitest run --project ui src/components/checkout && pnpm exec vitest run --project unit src/config`. Expected: FAIL.
- [ ] **Step 3: Implement.** Until O18 merges, a placed order lands on the pending `/order/…` 404; nothing is deployed, and O20 covers the whole path.
- [ ] **Step 4: Run** it (expected: PASS) and the full local check including `e2e/links.spec.ts`. **Visual** against `checkout.html?state=checkout-step-3`, `?state=cod-disabled` and `?state=checkout-review`.
- [ ] **Step 5: Commit** `feat(checkout): add payment, review and place order`.

  Split seam if over 400 lines: `pay-online.ts` + the dev pay page and route in their own PR, merged first.

### Task O18: Order detail and confirmation page (PR `feat/order-page`)

**Depends on:** O11, O17.

**Files:**
- Create: `src/app/(store)/order/[number]/page.tsx`, `src/components/orders/{order-copy.ts,orders-api.ts,orders-api.test.ts,order-detail.tsx,order-timeline.tsx,cancel-dialog.tsx,order-detail.test.tsx}`, `src/styles/orders.css`.
- Modify: `src/app/globals.css` [C16], `src/config/routes.ts` (remove the `/order/…` pending entry), `docs/dev/architecture.md`, `CHANGELOG.md`.

**Interfaces:**
- Consumes: O11 routes; O7 `OrderView`, `TimelineStep`; O10 `/pay`; O17 `payOnline`; `Overlay` (dialog, `returnFocusTo`), `Radio`, `TextField`, `Rupees`, `announce`, K4 `cartStore.signIn()`.
- Produces:
  - `orders-api.ts`: `listOrders()`, `getOrder(number)`, `cancelOrder(number, body)`, `reorder(number)`, `payOrder(number)`; nothing throws.
  - The page: static shell, `metadata = { title: "Your order", robots: { index: false } }`, a leaf `Suspense` with a static loading fallback around `OrderDetail`, which reads `useParams().number`.
  - `OrderDetail`: the prototype `order.html` layout: head by state, copy verbatim from `flows.js` (placed: "We’re checking your prescription" and its body without the "We’ll text and email you" clause; shipped, delivered, on hold, cancelled from the prototype states); the order number, date, packs and total; `OrderTimeline` ("Order status", the steps of `TimelineStep` with dates in IST and the courier and an `https` tracking link that opens in a new tab with `rel="noopener noreferrer"`); "Items"; "Payment" ("Cash on delivery", or "Paid online" / "Awaiting payment" / "Refund in progress" / "Refunded" when online); "Delivery address"; "Prescription"; actions: "Cancel order" when `canCancel`, "Re-order" (puts the lines in the cart, announces, links to `ROUTES.cart`; a `trimmed` or `removed` result says what did not fit), "Pay now" when `canPay`.
  - `CancelDialog`: "Cancel this order?", "You can cancel until the order is packed.", "Why are you cancelling?" with the five reasons in prototype order and labels, "Tell us more (optional)" (≤ 500), "Cancel order", "Keep order"; a `not_cancellable` answer says "This order is already being packed, so it can’t be cancelled here. Contact us for help." (awaiting owner approval).
  - 404 from the API → the page shows "We couldn’t find this order." with a link to `ROUTES.orders` (awaiting owner approval).

- [ ] **Step 1: Write the failing tests** (`order-detail.test.tsx`, API mocked): placed → the head and "Cancel order"; packed → no cancel; cancelling with "My doctor changed the prescription" calls `cancelOrder` with `prescription_changed`, closes the dialog, returns focus and announces; on hold → the timeline step marked rejected; a tracking URL that is `http:` is shown as text, not a link; `findClaims` is `[]`; no refund wording for a COD order. `orders-api.test.ts`: 404 → `not_found`.
- [ ] **Step 2: Run** `pnpm exec vitest run --project ui src/components/orders && pnpm exec vitest run --project unit src/styles src/config`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** it (expected: PASS) and the full local check (`pnpm build` must report `/order/[number]` without a blocking-route error). **Visual** against every `order.html` state.
- [ ] **Step 5: Commit** `feat(orders): add the order page with timeline, cancel and re-order`.

  Split seam if over 400 lines: `CancelDialog` and its tests in a second PR.

### Task O19: Order list and the links to it (PR `feat/order-list`)

**Depends on:** O18; K6 (the cart empty state).

**Files:**
- Create: `src/app/(store)/account/orders/page.tsx`, `src/components/orders/order-list.tsx`, `order-list.test.tsx`.
- Modify: `src/config/routes.ts` (`ROUTES.orders = "/account/orders"`), `src/components/shell/store-footer.tsx` and its test ("Track an order" → `ROUTES.orders`), the cart empty state in `src/components/cart/cart-page.tsx` ("Reorder a past order" → `ROUTES.orders`, prototype copy), `e2e/helpers/pages.ts` (`START` gains `/account/orders`), `docs/dev/architecture.md`, `CHANGELOG.md`.

**Interfaces:**
- Consumes: O18 `listOrders`; O7 `OrderSummary`; `OperateShell`, `EmptyState`, `openLogin`.
- Produces: `/account/orders` (static, title "Your orders", `noindex`): `OperateShell` with the title "Your orders"; `OrderList` renders `a.oitem` rows exactly as `account.html?state=account-orders` (number, items label, "Placed <d MMM yyyy>", total, status tag: `tag--wait` "Pharmacist check" for placed, `tag--done` "Delivered", `tag--off` "Cancelled", and for the others "Awaiting payment", "Confirmed", "Packed", "Shipped", "On hold" awaiting owner approval); signed out → the sign-in panel calling `openLogin(ROUTES.orders)`; none → `EmptyState` "No orders yet" with "Browse medicines" (awaiting owner approval).

- [ ] **Step 1: Write the failing tests**: three summaries render three links to `/order/<number>` in the given order with the right tags; signed out → the panel; empty → the empty state; the footer test expects "Track an order" → `/account/orders`; `findClaims` is `[]`.
- [ ] **Step 2: Run** `pnpm exec vitest run --project ui src/components/orders/order-list.test.tsx src/components/shell src/components/cart`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** it (expected: PASS) and the full local check, including `e2e/links.spec.ts`. **Visual** against `account.html?state=account-orders` (without the tab rail).
- [ ] **Step 5: Commit** `feat(orders): add the order list and link to it`.

### Task O20: Checkout and order end-to-end tests (PR `test/e2e-orders`)

**Depends on:** O17, O19; R7.

**Files:**
- Create: `e2e/checkout.spec.ts`, `e2e/orders.spec.ts`.
- Modify: `playwright.config.ts` (the e2e server env gains `ONLINE_PAYMENTS_PREVIEW=1` and a generated `FAKE_PAYMENTS_SECRET`), `docs/dev/testing.md`, `CHANGELOG.md`.

**Interfaces:**
- Consumes: every page above; `/dev/outbox`; `/dev/pay`.

- [ ] **Step 1: Write the tests** (each run uses a fresh email and its own `x-real-ip`; `collectConsoleErrors` empty at the end of each):
  - `checkout.spec.ts`:
    1. COD: add `sacuwin-100` × 2 → sign in → `/checkout` → add an address → upload a generated 1200 × 1600 PNG with patient "Asha Rao" → choose COD → Review shows "₹774" → Place order → `/order/AAR-…` shows "We’re checking your prescription"; the header cart pill shows 0.
    2. Double click on Place order (`dblclick`) → the order list has exactly one new order.
    3. Prepaid (preview flag on): choose online → the fake page → Pay → the order page shows "Paid online"; a same-origin `fetch("/api/orders")` shows it `placed`.
    4. Prepaid → Fail → back on the order page with "Pay now"; Pay now → Pay → placed.
  - `orders.spec.ts`: cancel a placed COD order with a reason → "Cancelled" on the page and in the list; Re-order → `/cart` holds the same lines; a second account opening the first account's order URL sees "We couldn’t find this order."
- [ ] **Step 2: Run** `pnpm test:e2e e2e/checkout.spec.ts e2e/orders.spec.ts` on the seeded e2e database. Expected: PASS (these pin behaviour built in O14–O19; a failure is a bug to fix in this PR, test first).
- [ ] **Step 3: Commit** `test(e2e): cover checkout, prepaid payment, cancel and re-order`.

### Task O21: Phase O finish-review gate (PR `fix/o-finish-review`)

**Files:** whatever the review finds. Also `docs/decisions/phase-o-ledger.md` (the execution ledger persisted), `docs/decisions/rulings.md` (provisional rulings the owner confirmed or changed), `docs/handoff.md` (Current state; deploy blocker 1 gains "set `PAYMENTS_PROVIDER=none` or Razorpay keys"; owner actions), `CHANGELOG.md`.

- [ ] **Step 1:** A fresh reviewer (most capable model) reads `<O1 base>..main` against this plan and `docs/requirements.md`, with Review Focus 1–5 as the checklist, and checks every `/api/{orders,checkout,payments,account,cron}/**` handler for Origin (or signature or secret), `no-store`, the refresh header, `await connection()`, ownership in every filter and error-name-only logging; and that no amount anywhere comes from a request body.
- [ ] **Step 2:** VISUAL at 1440 and 390 for every checkout state, `/order/[number]` in each status, `/account/orders` and the fake pay page, against the prototype, also under reduced motion.
- [ ] **Step 3:** Fix findings test-first, one commit each; keep the PR ≤ 400 lines or split it.
- [ ] **Step 4:** Run the full local check and the parts of the master plan's manual script that need no admin UI (the staff steps wait for phase D): a COD order placed and cancelled; a prepaid fake-gateway order paid, cancelled and refunded; and a Razorpay **test-key** smoke on a preview (one paid order, one cancel with refund, the webhook delivered, then re-sent from the dashboard and answered `duplicate`), recorded in the PR body.
- [ ] **Step 5: Commit** `fix(orders): apply the phase O finish-review fixes`.

## After this plan

- **D (admin):** the order queue reads `status_updatedAt`; every staff move is `applyTransition` with `by: "staff"` and a staff `actor`; Rx approval confirms each `placed` or `on_hold` order with that `rxId` (`rxId_status`); rejection holds them (the `flag_refund` effect does the rest); ship records `shipment` (https tracking URL); "mark COD collected" sets `payment.codCollectedAt`; "cancel and refund" is staff `cancel` + `executeRefund`; `payment.mismatch` rows get a staff view.
- **N:** order placed, Rx approved, Rx rejected, shipped, delivered, cancelled and refunded messages hang off `appendAudit`'s `order.status`, `payment.paid` and `payment.refunded` writes (or the same call sites); restore "We’ll text and email you …" on the order page.
- **P1:** wraps `/account/orders` in the tab rail; address edit and delete in `addresses.ts`; deletion and export include orders (retention rules decide what must be kept).
- **H:** CSP for Checkout.js (`script-src https://checkout.razorpay.com`, `frame-src https://api.razorpay.com`) with a test; the H4 gate refuses `PAYMENTS_PROVIDER=fake`, a `rzp_test_` key with `onlinePayments`, and a missing `CRON_SECRET`.
- **Owner:** Razorpay test keys, automatic capture, the webhook secret; Vercel Pro for the 10-minute cron; the GST invoice issuer and HSN codes (invoices); the returns process (§7).
