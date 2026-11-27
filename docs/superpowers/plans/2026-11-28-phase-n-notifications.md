# Phase N (Notifications) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Text and email a customer, on every verified channel, when their order is placed, its prescription is approved or rejected (on hold), it ships (with the AWB), is delivered, is cancelled and is refunded. Messages carry only the order number, the status and a link, never prescription content. They go through a deduplicated Mongo outbox with a cron sender (retry, backoff, dead letters), MSG91 (DLT) for SMS and Resend for email. The same phase adds the hourly sweep of orphaned prescription files. 12 tasks, each at most 400 changed lines.

**Architecture:**
- The rules stay pure: `src/server/notifications/rules.ts` (message types, the transition → message map, dedupe keys, backoff, channel choice, the vars schema) and `templates.ts` (the DLT SMS text and the email HTML and text). `src/server/security/mask.ts` masks a phone or email wherever one must appear.
- The **transactional outbox**: an order change that should notify runs `enqueueOrderNotifications` **inside the same MongoDB transaction** as the change (O's `applyTransition`, COD placement, the refund write). It writes one `notifications` document per channel as an upsert on a unique `dedupeKey`, so a retried transaction, a replayed webhook or a double cancel never makes a second message. The outbox holds ids and non-personal vars only. The phone or email is read from `users` at send time.
- `sendDueNotifications` (cron `GET /api/cron/notify`, every minute) claims due messages one at a time and resolves the current verified destination. It applies the per-user rate limit and calls `getDeps().sms` or `.email`, then settles each message as `sent`, `skipped`, retried with backoff, or `dead`. Email is at-least-once, with Resend's `Idempotency-Key` making it effectively once. SMS is at-most-once: a lost outcome is never resent.
- The providers sit behind `SmsProvider` and `EmailProvider` in `getDeps()`: the existing mocks, which write to `dev_outbox` and are shown at `/dev/outbox`, plus `fetch`-based MSG91 and Resend adapters (no SDKs). Production refuses mocks and the Resend test sender, both when deps are built and again at send time.
- `sweepRxFiles` (cron `GET /api/cron/sweep`, hourly) lists the `FileStore` by prefix and age with a saved cursor. It deletes `rx-staging/` files older than an hour, and `rx/` files older than an hour that have no `prescriptions` record. It is bounded per run and idempotent.

**Tech Stack:** Next.js 16.4 route handlers, TypeScript 6.0 strict, `mongodb` 7.9 (transactions on the replica set; `MongoMemoryReplSet` in int tests) + zod 4.6, MSG91 v5 Flow API and Resend REST API over `fetch`, `@vercel/blob` 2.9 `list`, Vercel Cron, Vitest 5 (`unit`, `ui`, `int`), Playwright 1.65.

**Spec:**
- `docs/requirements.md` (the authority; there is no separate spec): §5.7 Notifications ("Sent on: OTP; order placed; Rx approved; Rx rejected (with what to do next); shipped (tracking link); delivered; cancelled/refunded. Messages never include prescription contents or diagnosis."); §5.6 (statuses, courier and tracking); §6 (approval confirms, rejection holds); §7 (refund to source in 5–7 working days); §9 security; §10 DPDP (consent, marketing separate and off by default, retention); §12 items 1 (domain) and 2 (DLT).
- `docs/plan/project-plan.md`, Stage 5: data model "notifications (outbox with dedupe)"; phase row **N** ("outbox and cron; MSG91; Resend + email templates; event wiring"); Decisions ("Email + SMS on order placed, Rx approved/rejected, shipped, delivered"); Stage 4 Messaging (MSG91, DLT-native; Resend); "no Rx content in messages or logs"; owner inputs (domain, DLT).
- `docs/handoff.md`: "What is next" row N (adapters keep OTP codes out of logs; DLT templates; no prescription content), deploy blocker 1, owner actions 2 and 3.
- `docs/decisions/rulings.md`: "Phase K+R plan (provisional)" (the sweep carried to N; the R4 atomicity paragraph naming the two sweeps; "We'll text you when it's done"), "Phase O plan (provisional)" (cron, `CRON_SECRET`, the order page string N restores, F16 refund deferral).
- `docs/superpowers/plans/2026-11-28-phase-o-orders-payments.md`: `applyTransition`, `OrderDoc`, `withTransaction`, `appendAudit`, the reconcile cron, "After this plan → N".
- `docs/dev/architecture.md` (Providers container, Collections), `AGENTS.md` (Business invariants, logging).
- Code at `main` 0529940 (#236).

**Task ids.** This plan's tasks are N1–N12. O task numbers (O2, O6 …) are the Phase O plan's.

## Global Constraints

Every Global Constraint of the Phase O plan applies (branching, Conventional Commits with **no `Co-Authored-By` trailer and no "Generated with" line**, the merge gate, the Definition of done, Routes, Time, Atomicity, Indexes, Inputs, Secrets, Mocks). The ones N tasks touch are restated:
- **≤ 400 changed lines per PR** (`pnpm pr-size origin/main`), Markdown included. Only `docs/superpowers/**`, `docs/decisions/**`, the lockfile, `data/**`, `public/**`, binaries and `// @generated shadcn` files are excluded. Over the cap, split at the seam the task names. Never trim tests or meaningful docs to fit.
- **Definition of done:** tests first, then `pnpm lint && pnpm typecheck && pnpm test:unit && pnpm test:int && pnpm build`, then the seeded e2e run. Plus a `CHANGELOG.md` line under `## [Unreleased]` ending with the PR number, `docs/dev/**` updated (in `architecture.md` only your own files' bullets, collection rows and rate-limit keys), and a ruling in `docs/decisions/rulings.md` for any rule that changes.
- **Time:** `src/server/**` never calls `new Date()` or `Date.now()`. Functions take `now: Date`, and routes read `getDeps().now()` once per request. The one allowed exception is the memory file store's default clock (Task N7), which is a test fake.
- **Atomicity:** enqueueing happens inside the caller's transaction and is an `updateOne({ dedupeKey }, { $setOnInsert }, { upsert: true, session })`, never `insertOne`: an E11000 inside a transaction aborts it. A claim is a `findOneAndUpdate` on `{ status, nextAttemptAt | leaseUntil }`. There is never an unconditional read-then-write.
- **Cron routes** (`/api/cron/*`) are server to server. Their first statement is `await connection()`, then `assertCronAuth(req)` (`Authorization: Bearer <CRON_SECRET>`, timing-safe). They take no Origin check and set no cookies, and they answer `jsonResponse` (`no-store`) with counts only.
- **Privacy in messages:** a message carries only the order number, a status sentence, our order link and, for shipped, the courier and AWB, plus in email only an `https` courier tracking link. It never carries a product or medicine name, a quantity, an amount, the patient's or doctor's name, an Rx reason code or staff note, an address, or a diagnosis. Transactional only: no promotion, no cross-sell, no marketing footer. `findClaims` returns `[]` on every template.
- **Privacy in storage and logs:** `notifications` documents hold no phone or email in clear, only `toMasked` (Task N1 format). Logs carry the message id, type, channel, status and error **name** only. Never log or store a provider response body, an auth key, an OTP code, or a phone or email in clear. A provider error is mapped to a fixed code before it leaves the adapter.
- **Secrets:** the repo is public. `MSG91_AUTH_KEY`, `RESEND_API_KEY` and `CRON_SECRET` live only in Vercel env and `.env.local`, and `.env.example` names them with empty values. Tests generate fake keys. The DLT template ids and the sender id are not secret but still go in env, not in code.
- **Mocks:** `SMS_PROVIDER=mock` and `EMAIL_PROVIDER=mock` stay refused when `isMockForbidden()`. The Resend test sender (`@resend.dev`) counts as a mock.
- **Client imports:** nothing under `src/server/notifications/**` joins the client-import allowlist.

Business values, used verbatim:
- **Message types:** `NOTIFY_TYPES = ["order_placed", "rx_approved", "rx_rejected", "shipped", "delivered", "cancelled", "refunded"]`. SMS templates are `["otp", ...NOTIFY_TYPES]` (8 DLT templates).
- **Triggers** (on the order document after the change): to `placed` from `null` (COD insert) or `pending_payment` (capture) → `order_placed`; to `confirmed` → `rx_approved`; to `on_hold` → `rx_rejected`; to `shipped` → `shipped`; to `delivered` → `delivered`; to `cancelled` from anything but `pending_payment` → `cancelled`; `payment.status` becoming `refunded` → `refunded`. Nothing else notifies.
- **Dedupe key:** `order:<orderIdHex>:<seq>:<channel>`, where `seq` is the index of the `statusHistory` entry the change pushed, or `refund` for `refunded`.
- **Retry:** `MAX_ATTEMPTS = 5`; waits after a retryable failure `BACKOFF_MS = [60_000, 300_000, 900_000, 3_600_000, 14_400_000]`; `SEND_LEASE_MS = 60_000`; `STALE_AFTER_MS = 172_800_000` (48 h); outbox TTL 90 days.
- **Rate limit:** `notify:user:<userIdHex>:<channel>`, 10 per hour; over it the message is deferred to the window's reset, not dropped.
- **Sender batch:** at most 50 messages per run. Cron `* * * * *`.
- **Sweep:** age threshold `SWEEP_AGE_MS = 3_600_000`; at most 5 list pages of 500 keys per prefix and 200 deletions per run. Cron `23 * * * *`.
- **Refund wording:** "It can take 5-7 working days to reach your account."

## Review Focus

1. **A sender run dies after MSG91 accepted an SMS but before the outbox recorded it, or two runs overlap.** Expected: the SMS is never sent twice, and an email is sent at most once to the customer, because Resend dedupes on `Idempotency-Key = dedupeKey`. Tests: Task N6 (an expired `sending` SMS lease → `dead` `outcome_unknown`, no second provider call; an expired email lease → resent with the same idempotency key; two parallel `sendDueNotifications` → each message sent once).
2. **The same change reported twice:** a transaction the driver retries, the callback, the webhook and the cron all capturing one payment, or a double-tapped cancel. Expected: one message per channel per real change, while a real repeat (on hold → confirmed → on hold) does send again. Tests: Task N5 (enqueue twice with one key → one document), Task N9 (three parallel `capturePayment` → one `order_placed` per channel; hold, confirm, hold → two `rx_rejected` per channel).
3. **A customer with one verified channel, or who changes their phone between the order and the send.** Expected: only verified channels are used, at their current value; the other channel's message is `skipped` with `no_channel`; nothing is sent to an old number. Test: Task N6.
4. **Production configured with a mock, or with the Resend test sender, because DLT or the domain are not ready.** Expected: `getDeps()` refuses to build, and a mock forced in with `setDepsForTests` is refused at send time without marking the message sent. Tests: Task N4 and Task N6.
5. **A sweep over a store with thousands of young files, a malformed key, or a Mongo error halfway through.** Expected: the run stays within its bounds and makes progress across runs through the saved cursor. It never deletes a final file whose record lookup failed and never deletes a key it cannot parse. Test: Task N8.

## Decisions taken in this plan (rulings; override any)

Each line is "Ruling: what — why — cost if wrong". Copied into `docs/decisions/rulings.md` ("Phase N plan (provisional)") in the docs PR that commits this plan. Where one changes an earlier ruling, the later line wins.

**Messages**
- Ruling: there are seven order message types plus OTP, so **8 DLT SMS templates**. Requirements §12 says "6", which undercounts §5.7's list. If a non-OTP template id is missing from env, that SMS is `skipped` (`no_template`) and the email still goes — §5.7 lists seven order events, and the owner may register templates in batches — cost if wrong: the owner registers two templates more than needed, or runs email-only for a type until its template clears.
- Ruling: the triggers are the order states in "Business values". An order cancelled while still `pending_payment` (an abandoned payment) sends nothing — the customer never received "placed", and a late capture on it is refunded and sends `refunded` — cost if wrong: a customer who abandoned payment gets no "cancelled" note.
- Ruling: "Rx approved" is the order reaching `confirmed`, and "Rx rejected" is it reaching `on_hold`. Both are per order. A prescription reviewed with no order sends nothing, so the K+R string "We'll text you when it's done." on `/account/prescriptions` **stays dropped** (this supersedes the K+R "After this plan → N" line) — §5.7's messages are order events, and a standalone Rx message would need its own template and wording — cost if wrong: one more type and template, plus one string.
- Ruling: messages carry **no reason code, staff note, item name, quantity, amount, patient or doctor name, or address**. They carry only the order number, the status, our order link and, for shipped, the courier and AWB, plus in email the `https` tracking link. Rx rejected says what to do next in generic words: "Please upload a new prescription or contact us." This supersedes the K+R line that rejection messages carry the reason code's copy — a medicine name or a rejection reason in an SMS on a lock screen discloses health data (§5.7, DPDP), and a "reason" is prescription content — cost if wrong: the customer taps the link to see why.
- Ruling: shipped SMS links to our order page, not the courier's: DLT requires every URL in an SMS to be whitelisted, and courier URLs vary. The email adds the courier tracking link only when it is `https` — cost if wrong: one more tap for SMS-only customers.
- Ruling: links are `<APP_URL>/order/<number>`, a signed-in page with no token in the URL. Outside production a missing `APP_URL` falls back to `http://localhost:3000`, and production already refuses a missing `APP_URL` (`getSiteEnv`). The owner whitelists the domain's URL in DLT (owner action) — cost if wrong: the shopper signs in before seeing the order.
- Ruling: the DLT template text in Task N2 is pinned exactly: ASCII only (straight apostrophes, a hyphen in "5-7"), each variable `{#var#}`, and "Aarvion" in every message. It awaits owner approval, and the owner registers it verbatim — DLT rejects an SMS whose text differs from the registered template — cost if wrong: re-registering a template takes days.
- Ruling: email is a single-column HTML document (`lang="en"`, a `<title>`, system fonts, text contrast at least 7:1, a descriptive link, no images, no remote assets, no tracking pixel) plus a text part with the same content. The footer reads "This is a service message about your Aarvion order." and has no marketing. Open and click tracking stay off in Resend (owner setting, recorded in `docs/dev/deploy.md`) — cost if wrong: a plainer email than a designed one.

**Channels and consent**
- Ruling: every **verified** channel (`phoneVerifiedAt`, `emailVerifiedAt`) gets every transactional message. The marketing consent is never read by this phase, and v1 has no opt-out from transactional messages — DPDP permits processing needed to perform the order, and §10's marketing opt-in is a separate thing — cost if wrong: P1 adds a per-channel preference and one check in `resolveDestination`.
- Ruling: the outbox **stores no phone or email**. The destination is read from `users` at send time, so a changed number gets the message and a removed channel is `skipped` (`no_channel`). `toMasked` is stored after the send for a staff view — this keeps personal data out of a 90-day collection — cost if wrong: a message is never sent to a number the user removed, which is what we want.
- Ruling: one document per channel is always enqueued (`sms` and `email`), and channel choice happens at send — no user read inside the order transaction, and a channel verified later still counts — cost if wrong: a few `skipped` rows.

**Outbox and sender**
- Ruling: enqueueing is inside the order change's transaction, as an upsert on the unique `dedupeKey` (`order:<id>:<seq>:<channel>`, where `seq` is the pushed `statusHistory` index or `refund`). An upsert never aborts the transaction, and `seq` lets a legitimate repeat send again while a replay of the same change cannot — cost if wrong: none.
- Ruling: the sender runs from `GET /api/cron/notify` every minute (`* * * * *`), up to 50 messages a run, with no `after()` kick from the order routes — one entry point instead of hooks in every O and D route; Vercel Pro allows one-minute crons (owner action 4) — cost if wrong: up to about a minute's delay; Hobby's daily cron would delay messages by a day.
- Ruling: **email is at-least-once** with Resend `Idempotency-Key: <dedupeKey>` (Resend keeps keys for 24 h), so an expired lease is retried. **SMS is at-most-once**: an expired `sending` SMS lease becomes `dead` with `outcome_unknown` and is never resent — MSG91's Flow API has no idempotency key, and a duplicate SMS costs money and confuses, while a missing one is visible on the order page — cost if wrong: a crashed run can lose one SMS.
- Ruling: five attempts, with waits of 1, 5, 15, 60 and 240 minutes. A permanent provider error (a 4xx other than 408 and 429, an invalid number, a template mismatch) is `dead` at once. A message due more than 48 h after it was created is `dead` with `stale`, since a late "shipped" after "delivered" is worse than none. Dead rows stay for the D staff view, and every row expires after 90 days — cost if wrong: four constants.
- Ruling: a rate limit of 10 per hour per user per channel (`notify:user:<id>:<channel>`). Over it, the message is deferred to the window's reset and the attempt is not counted — this guards against a bug loop flooding a phone without losing a real message — cost if wrong: one number.
- Ruling: **OTP stays a direct, synchronous send** and does not go through the outbox. It moves onto the MSG91 `otp` template and Resend, and its email copy is unchanged — a code must never be stored, and login cannot wait for a cron — cost if wrong: none.

**Providers**
- Ruling: both adapters use `fetch` (injectable, 10 s `AbortSignal.timeout`) with no SDK. MSG91 is `POST https://control.msg91.com/api/v5/flow` with header `authkey`, body `{ template_id, sender, short_url: "0", recipients: [{ mobiles: "91XXXXXXXXXX", ...vars }] }`, and treats `type: "success"` as sent. Resend is `POST https://api.resend.com/emails` with Bearer auth and `Idempotency-Key`, body `{ from, to: [to], subject, html, text, reply_to? }`. Tests inject `fetch`, so N does not wait on O5's MSW — no new dependency in a public repo; four request shapes — cost if wrong: the first real-key smoke (Task N12) corrects a field name.
- Ruling: env names: `MSG91_AUTH_KEY`; `MSG91_SENDER_ID` (the DLT header, `^[A-Z]{6}$`); `MSG91_TEMPLATES` (one JSON object from logical template to MSG91 template id, `otp` required, the others optional); `RESEND_API_KEY`; `EMAIL_FROM` (`Name <local@domain>`); optional `EMAIL_REPLY_TO`. Each is required only when its provider is selected — one JSON variable instead of eight, validated by zod with the closed key set — cost if wrong: renaming env vars in Vercel.
- Ruling: production refuses a mock (unchanged) **and** an `EMAIL_FROM` at `resend.dev`, Resend's test sender, which only delivers to the account owner. Both refusals happen in `getDeps()` and again at send time (`assertSendable`), mirroring `isMockForbidden()` — cost if wrong: none.
- Ruling: there is **no `none` provider for SMS or email**, so production stays blocked until DLT and a verified domain exist. Launching with email only would also disable phone OTP login and needs its own UI — cost if wrong: if the owner wants an email-only launch, one enum value plus a login gate.
- Ruling: `SmsProvider` and `EmailProvider` gain `readonly kind`, `SmsProvider.send` takes the closed `SmsTemplate` union, and `EmailProvider.send` takes an optional `idempotencyKey`. Provider failures throw `ProviderError(code: "retryable" | "permanent", status?)` with no body — cost if wrong: none.
- Ruling: masks are `maskPhone("+919876543210") = "+91******3210"` and `maskEmail("asha.rao@example.com") = "a***@e***.com"` (first character of the local part, first character of the domain, then the last label). They are used only for `toMasked` and in any staff view. Logs never carry even the masked value — cost if wrong: one format.

**Sweep**
- Ruling: `FileStore` gains `list(prefix, { cursor, limit })` returning `{ key, uploadedAt }` items and a next cursor (Blob `list`, a local directory walk by mtime, memory with a clock option). The prefix must be exactly `rx/` or `rx-staging/` — the sweep needs age, and the stores had no listing — cost if wrong: one more method on three stores.
- Ruling: the sweep runs hourly at `23 * * * *` from `GET /api/cron/sweep`. It saves each prefix's cursor in `sweep_state` (`_id` = the prefix) and resets it to null at the end of the listing. Each run reads at most 5 pages of 500 keys per prefix and deletes at most 200 files — Blob lists by name, not age, so without a cursor young files at the front would starve older ones further on — cost if wrong: a large backlog takes several hours to clear.
- Ruling: an `rx-staging/` key older than an hour is deleted (a slot lives 15 minutes, and a claim lease 30 s). An `rx/<uid>/<id>.<webp|pdf>` key older than an hour is deleted only when **no** `prescriptions` document with that `_id` exists, whatever its owner. A key that does not parse is never deleted (counted as `malformed`). A Mongo error ends the run before any `rx/` deletion — fail closed on medical records — cost if wrong: an orphan whose `_id` collides with another user's record is kept (practically impossible with ObjectIds).
- Ruling: a run that deletes anything writes one `files.sweep` audit row (actor `system`, meta: counts only) — deleting near medical records should leave a trace — cost if wrong: one row per hour at most.

**Wiring and copy**
- Ruling: `assertCronAuth(req)` lives in `src/server/security/cron-auth.ts`. Whichever of O13, N6 or N8 merges first creates it, together with `CRON_SECRET` (optional in env, at least 32 characters; unset → 500 `server_misconfigured`). The others reuse it, and an O13 that inlined the check switches to it in a separate refactor commit — cost if wrong: a merge conflict on a hotspot.
- Ruling: the order page restores the O-plan string channel by channel: "We’ll text and email you" with both channels verified, "We’ll text you" with phone only, "We’ll email you" with email only, each followed by " when your order is approved, then pack your medicines." With neither verified the clause is omitted. `OrderView` gains `notify: { sms: boolean; email: boolean }` — the copy must be true for this customer — cost if wrong: one field.
- Ruling: a refund's `refunded` message is enqueued in a transaction with the write that sets `payment.status: "refunded"` (O9's `markRefundProcessed` and the `processed` branch of `executeRefund`, both wrapped in `withTransaction` by Task N9) — those writes are conditional updates today, and an enqueue after them could be lost in a crash — cost if wrong: none.

## File Structure

```
src/server/notifications/   rules.ts (pure) templates.ts (pure) outbox.ts (collection, enqueue, claim, settle)
                            enqueue.ts (enqueueOrderNotifications, enqueueRefunded) send.ts (sendDueNotifications)
src/server/security/        mask.ts cron-auth.ts (shared with O13)
src/server/providers/       types.ts (kinds, SmsTemplate, idempotencyKey, list) provider-error.ts
                            msg91-sms.ts resend-email.ts mock-sms.ts mock-email.ts (kind)
                            memory-files.ts local-files.ts blob-files.ts file-keys.ts (list, assertListPrefix)
src/server/files/           sweep.ts (sweepRxFiles, sweep_state)
src/server/env.ts           (+ MSG91_*, RESEND_API_KEY, EMAIL_FROM, EMAIL_REPLY_TO; CRON_SECRET if O13 not merged)
src/server/deps.ts          (msg91, resend, refusals)
src/server/audit.ts         (+ files.sweep)
src/server/orders/          orders.ts place.ts refunds.ts view.ts (hooks, Task N9 and N10)
src/app/api/cron/           notify/route.ts sweep/route.ts
src/components/orders/      order-copy.ts order-detail.tsx (Task N10)
vercel.json                 (two crons)
tests/helpers/              notify.ts (fakeFetch, seedNotification)
e2e/                        notifications.spec.ts
```

New collections: `notifications`, `sweep_state`. `dev_outbox` keeps its role (mock captures).

**Order and parallelism** (each arrow is "merged before"):
- **Wave 1, now, in parallel with O** (pure or server-only, disjoint from O's files): **N1** (rules, mask) → **N2** (templates); N1 → **N3** (provider contract, MSG91) → **N4** (Resend, deps refusals); N1 → **N5** (outbox store); **N7** (FileStore.list) → **N8** (sweep and its cron).
- N2 + N4 + N5 → **N6** (sender and notify cron).
- **Wave 2, after O:** N5 + O2 (`applyTransition`) + O6 (`placeOrder`) + O9 (`refunds.ts`) + O10 (`capturePayment`) → **N9** (event wiring). N9 + O7 + O18 → **N10** (copy). N6 + N10 + O20 → **N11** (e2e). **N12** (finish-review gate) runs last.
- Hotspots, so merge serially and merge `origin/main` before the last push: `src/server/env.ts` and `deps.ts` (N3, N4, N6 or N8; O4, O5, O13); `src/server/providers/types.ts` (N3, N7; O4); `src/server/audit.ts` and `register-all.ts` (N5, N8; O2, O12); `vercel.json` (N6, N8; O13); `src/server/orders/*.ts` (N9 after O2, O6, O9); CHANGELOG and `architecture.md` (all).

**Interfaces assumed from Phase O** (names as in the O plan; if a merged O task differs, the N task adapts to what is on `main` and records it in its PR):
- O2 `src/server/db/transaction.ts`: `withTransaction<T>(fn: (session: ClientSession) => Promise<T>): Promise<T>`.
- O2 `src/server/orders/orders.ts`: `OrderDoc` (with `_id`, `number`, `userId`, `status`, `rxRequired`, `payment.status`, `shipment: { courier; awb; trackingUrl } | null`, `statusHistory: StatusHistoryEntry[]`); `applyTransition(i: { order; event; by; actor; now; set?; session? })` doing `findOneAndUpdate({ _id, status: from }, …, { returnDocument: "after" })` and `appendAudit(…)` in one transaction.
- O6 `src/server/orders/place.ts`: `placeOrder`, whose COD branch inserts the order (`status: "placed"`, one `statusHistory` entry) in `withTransaction`, and `insertOrder(doc, session)`.
- O9 `src/server/orders/refunds.ts`: `executeRefund(orderId, now)` (its `processed` branch sets `payment.status: "refunded"`); `markRefundProcessed({ paymentId, refundId, now }): Promise<boolean>`.
- O10 `capturePayment` ends in `applyTransition(payment_captured)` (so `order_placed` for prepaid comes through the O2 hook).
- O13 `CRON_SECRET` and `vercel.json` (`{ "crons": [ … reconcile … ] }`).
- O7 `src/server/orders/view.ts`: `toOrderView(order, …): OrderView`; O18 `src/components/orders/order-copy.ts` and `order-detail.tsx` (the placed body without the "We’ll text and email you" clause).
- O20 e2e helpers that place a COD order (`e2e/checkout.spec.ts` flow).
- Phase D (not required by N): staff `ship` passes `set: { shipment }` to `applyTransition`; N's tests seed that directly.

---

### Task N1: Notification rules and masking (PR `feat/notify-rules`)

**Files:**
- Create: `src/server/notifications/rules.ts`, `rules.test.ts`, `src/server/security/mask.ts`, `mask.test.ts`.
- Docs: `docs/dev/architecture.md` (a `notifications/` row; the `security/` row gains `mask.ts`), `AGENTS.md` (Business invariants gains a **Notifications** block: the triggers, "no Rx content", "no phone or email in clear in the outbox or logs"), `CHANGELOG.md`.

**Interfaces:**
- Consumes: type-only `OrderStatus` (`orders/status.ts`).
- Produces (`rules.ts`, pure, no imports at runtime except zod):
  - `NOTIFY_TYPES`, `type NotifyType`; `NOTIFY_CHANNELS = ["sms", "email"] as const`, `type NotifyChannel`; `SMS_TEMPLATES = ["otp", ...NOTIFY_TYPES] as const`, `type SmsTemplate`.
  - `notifyTypeFor(i: { from: OrderStatus | null; to: OrderStatus }): NotifyType | null`, the trigger table in "Business values" (status changes only; `refunded` is raised by `enqueueRefunded`).
  - `dedupeKey(i: { orderId: string; seq: number | "refund"; channel: NotifyChannel }): string`.
  - `MAX_ATTEMPTS`, `BACKOFF_MS`, `SEND_LEASE_MS`, `STALE_AFTER_MS`, `OUTBOX_TTL_MS = 7_776_000_000`, `NOTIFY_RATE = { limit: 10, windowMs: 3_600_000 }`, `SEND_BATCH = 50`.
  - `retryAt(attemptsSoFar: number, now: Date): Date | null` (null once `attemptsSoFar ≥ MAX_ATTEMPTS`).
  - `verifiedDestination(user: { phone?: string; phoneVerifiedAt?: Date; email?: string; emailVerifiedAt?: Date }, channel: NotifyChannel): string | null`.
  - `NotifyVars = z.strictObject({ number: z.string().regex(/^AAR-\d{4}-\d{5,}$/), link: z.url(), courier: z.string().regex(/^[A-Za-z0-9 .&-]{1,30}$/).nullable(), awb: z.string().regex(/^[A-Za-z0-9-]{4,30}$/).nullable(), trackingUrl: z.url().refine(u => u.startsWith("https://")).nullable() })`; `type NotifyVars`.
  - `orderLink(appUrl: string | undefined, number: string): string` (`http://localhost:3000` when undefined).
- Produces (`mask.ts`): `maskPhone(e164: string): string`, `maskEmail(email: string): string`.

- [ ] **Step 1: Write the failing tests**
  - `notifyTypeFor`: `{ from: null, to: "placed" }` → `order_placed`; `pending_payment → placed` → `order_placed`; `placed → confirmed` and `on_hold → confirmed` → `rx_approved`; `confirmed → on_hold` and `packed → on_hold` → `rx_rejected`; `packed → shipped` → `shipped`; `shipped → delivered` → `delivered`; `placed → cancelled` and `on_hold → cancelled` → `cancelled`; `pending_payment → cancelled` → `null`; `confirmed → packed` → `null`; `{ from: null, to: "pending_payment" }` → `null`.
  - `dedupeKey({ orderId: "a".repeat(24), seq: 3, channel: "sms" })` → `"order:aaaaaaaaaaaaaaaaaaaaaaaa:3:sms"`; `seq: "refund"` → `…:refund:email`.
  - `retryAt(0, t)` → `t + 60 s`; `retryAt(4, t)` → `t + 4 h`; `retryAt(5, t)` → `null`.
  - `verifiedDestination` returns the phone only when `phoneVerifiedAt` is set; an email without `emailVerifiedAt` → `null`.
  - `NotifyVars.parse` refuses an extra `items` key, a `javascript:` or `http:` tracking URL, a courier with `<` or a newline, and an order number `AAR-26-1`.
  - `maskPhone("+919876543210")` → `"+91******3210"`; `maskEmail("asha.rao@example.com")` → `"a***@e***.com"`; `maskEmail("x@mail.co.in")` → `"x***@m***.in"`.
- [ ] **Step 2: Run** `pnpm exec vitest run --project unit src/server/notifications src/server/security/mask.test.ts`. Expected: FAIL (modules missing).
- [ ] **Step 3: Implement** both files.
- [ ] **Step 4: Run** it (expected: PASS), then the full local check.
- [ ] **Step 5: Commit** `feat(notify): add notification rules and identifier masking`.

### Task N2: SMS and email templates (PR `feat/notify-templates`)

**Depends on:** N1.

**Files:**
- Create: `src/server/notifications/templates.ts`, `templates.test.ts`.
- Docs: `docs/dev/architecture.md`, `docs/dev/runbooks/register-sms-templates.md` (the 8 DLT texts verbatim, the header and URL whitelisting steps, where each MSG91 template id goes in `MSG91_TEMPLATES`), `CHANGELOG.md`.

**Interfaces:**
- Consumes: N1 `NotifyType`, `SmsTemplate`, `NotifyVars`; `findClaims` (`tests/helpers/claims.ts`, tests only); `SITE_CONFIG.legalName`.
- Produces:
  - `DLT_TEXT: Record<SmsTemplate, string>`: the registered text, exact copy, awaiting owner approval:
    - `otp`: `{#var#} is your Aarvion login code. It expires in {#var#} minutes. Do not share it with anyone. - Aarvion`
    - `order_placed`: `Aarvion: we have received your order {#var#}. A pharmacist will check your prescription next. Details: {#var#}`
    - `rx_approved`: `Aarvion: your prescription for order {#var#} is approved and the order is confirmed. We will pack it next. Details: {#var#}`
    - `rx_rejected`: `Aarvion: order {#var#} is on hold because we could not approve the prescription. Please upload a new prescription or contact us: {#var#}`
    - `shipped`: `Aarvion: order {#var#} has shipped with {#var#}, AWB {#var#}. Details: {#var#}`
    - `delivered`: `Aarvion: order {#var#} has been delivered. Details: {#var#}`
    - `cancelled`: `Aarvion: order {#var#} is cancelled. Details: {#var#}`
    - `refunded`: `Aarvion: the refund for order {#var#} has been processed. It can take 5-7 working days to reach your account. Details: {#var#}`
  - `SMS_VAR_ORDER: Record<SmsTemplate, readonly string[]>`: `otp` → `["code", "minutes"]`; `shipped` → `["number", "courier", "awb", "link"]`; every other type → `["number", "link"]`.
  - `renderSms(type: NotifyType, vars: NotifyVars): { template: SmsTemplate; vars: Record<string, string> }` (only the keys in `SMS_VAR_ORDER[type]`; a null var throws, since ship requires both courier and AWB).
  - `fillDlt(template: SmsTemplate, vars: Record<string, string>): string` (substitutes `{#var#}` in order; for tests and the mock's `/dev/outbox` preview).
  - `renderEmail(type: NotifyType, vars: NotifyVars): { subject: string; html: string; text: string }`, built from the copy below with every var HTML-escaped (`& < > " '`). Each body has the status sentence, then a link "View order <number>", then the footer. Shipped adds "Courier: <courier>, AWB <awb>." and, when `trackingUrl` is set, a link "Track with <courier>". Subjects, awaiting owner approval:
    - `order_placed` "We have received your order <number>"; body "A pharmacist will check your prescription next. We will let you know when the order is approved."
    - `rx_approved` "Order <number> is confirmed"; "Your prescription is approved and the order is confirmed. We will pack your medicines next."
    - `rx_rejected` "Order <number> is on hold"; "We could not approve the prescription for this order, so it is on hold. Please upload a new prescription or contact us. The order page says what to do next."
    - `shipped` "Order <number> has shipped"; `delivered` "Order <number> has been delivered"; `cancelled` "Order <number> is cancelled"; `refunded` "Refund processed for order <number>"; "It can take 5-7 working days to reach your account."
    - Footer: "This is a service message about your Aarvion order." then `SITE_CONFIG.legalName`.

- [ ] **Step 1: Write the failing tests**
  - Each `DLT_TEXT` value is ASCII only (`/^[\x20-\x7E]+$/`), contains "Aarvion", and its `{#var#}` count equals `SMS_VAR_ORDER[t].length`. `fillDlt` with each var 30 characters long and a 40-character link stays at most 160 characters for every template except `rx_rejected` and `refunded`, which are at most 306 (two parts; the test pins the part count).
  - `renderSms("shipped", vars)` returns the vars in the order `number, courier, awb, link`; with `awb: null` it throws.
  - `renderEmail("shipped", { …, courier: "Blue<script>", … })` cannot pass `NotifyVars`; a direct call with `courier: "A&B"` renders `A&amp;B` in the HTML and `A&B` in the text. With an `https` tracking URL the HTML has `href="https://…"` and the text has the URL; with `null` neither appears.
  - The HTML has `<html lang="en">`, a `<title>`, no `<img`, no `src=`, no `http://`, and one `<a` per link. The text part holds the same sentences as the HTML with the tags stripped.
  - Privacy: for every type, rendered with vars that pass `NotifyVars`, neither the SMS nor the email contains any seeded product name or slug (read from `data/products.json`), "₹", "Rs", a digit run that is not the order number or AWB, "patient" or "doctor".
  - `findClaims` over every `DLT_TEXT`, subject and text body returns `[]`, and no text contains "offer", "discount", "%" or "sale".
- [ ] **Step 2: Run** `pnpm exec vitest run --project unit src/server/notifications/templates.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** `templates.ts`, with exact copy as above and HTML from one `layout(title, paragraphs, links)` helper.
- [ ] **Step 4: Run** it (expected: PASS), then the full local check.
- [ ] **Step 5: Commit** `feat(notify): add the DLT SMS texts and the email templates`, then `docs(runbooks): add the DLT template registration runbook`.

### Task N3: Provider contract v2 and the MSG91 adapter (PR `feat/msg91-sms`)

**Depends on:** N1.

**Files:**
- Create: `src/server/providers/provider-error.ts`, `msg91-sms.ts`, `msg91-sms.test.ts`, `tests/helpers/notify.ts` (`fakeFetch`).
- Modify: `src/server/providers/types.ts`, `mock-sms.ts`, `mock-email.ts`, `src/server/env.ts` (+ `env.test.ts`), `src/server/deps.ts` (+ `deps.test.ts`), `src/server/auth/login.ts` (the `otp` template type only), `.env.example`, `docs/dev/architecture.md` (Providers container), `docs/decisions/environments.md`, `CHANGELOG.md`.

**Interfaces:**
- Consumes: N1 `SmsTemplate`, `SMS_TEMPLATES`.
- Produces:
  - `types.ts`: `SmsProvider { readonly kind: "mock" | "msg91"; send(msg: { to: string; templateId: SmsTemplate; vars: Record<string, string> }): Promise<{ providerMessageId: string }> }`; `EmailProvider { readonly kind: "mock" | "resend"; send(msg: { to; subject; html; text; idempotencyKey?: string }): Promise<{ providerMessageId: string }> }`. The mocks get `kind: "mock"`.
  - `provider-error.ts`: `class ProviderError extends Error { name = "ProviderError"; constructor(readonly code: "retryable" | "permanent", readonly status?: number) }`; `classifyHttp(status: number): "retryable" | "permanent"` (408, 429, 5xx and network or timeout errors → retryable; other 4xx → permanent).
  - `env.ts`: `MSG91_AUTH_KEY` (min 16), `MSG91_SENDER_ID` (`^[A-Z]{6}$`), `MSG91_TEMPLATES` (a JSON string parsed by `z.strictObject` over `SMS_TEMPLATES` keys, each `^[A-Za-z0-9]{8,40}$`, `otp` required), all optional in the schema; `requireMsg91Config(env): { authKey; senderId; templates: Partial<Record<SmsTemplate, string>> }` throws an `EnvError` naming the first missing one.
  - `msg91-sms.ts`: `createMsg91Sms(cfg: { authKey: string; senderId: string; templates: Partial<Record<SmsTemplate, string>>; fetchImpl?: typeof fetch }): SmsProvider`. `send` takes `to` as `+91XXXXXXXXXX` and sends `mobiles: "91XXXXXXXXXX"`. A template without an id throws `ProviderError("permanent")` with message `no_template`. It posts the body from the rulings with the vars as named keys. HTTP 200 with `type: "success"` → `{ providerMessageId: message }`; `type: "error"` → `permanent`; other statuses through `classifyHttp`. It never includes the body in an error.
  - `deps.ts`: `SMS_PROVIDER=msg91` → `createMsg91Sms(requireMsg91Config(env))`, replacing the "not implemented yet" throw for SMS.

- [ ] **Step 1: Write the failing tests**
  - `msg91-sms.test.ts` with `fakeFetch` recording requests: the URL is `https://control.msg91.com/api/v5/flow`, the method is POST, the `authkey` header is the key, the JSON body equals `{ template_id: <id of order_placed>, sender: "AARVON", short_url: "0", recipients: [{ mobiles: "919876543210", number: "AAR-2611-00042", link: "https://x.test/order/AAR-2611-00042" }] }`; the response `{ type: "success", message: "abc" }` → `{ providerMessageId: "abc" }`.
  - 500 → `ProviderError` `retryable`; 429 → `retryable`; 401 → `permanent`; 200 `{ type: "error", message: "+919876543210 invalid" }` → `permanent`, and `String(err)` and `err.message` do not contain `9876543210`; a fetch that rejects or times out → `retryable`; a template with no id → `permanent` `no_template`, and no fetch is made.
  - `env.test.ts`: a bad `MSG91_TEMPLATES` (not JSON, an unknown key, no `otp`) fails with a message naming `MSG91_TEMPLATES` and never echoing the value.
  - `deps.test.ts`: `SMS_PROVIDER=msg91` with full config → `sms.kind === "msg91"`; with `MSG91_AUTH_KEY` missing → an `EnvError` naming it; `EMAIL_PROVIDER=resend` still throws "not implemented yet" (until N4).
  - `src/server/auth/login.test.ts` stays green, since `templateId: "otp"` now type-checks against `SmsTemplate`.
- [ ] **Step 2: Run** `pnpm exec vitest run --project unit src/server/providers src/server/env.test.ts src/server/deps.test.ts src/server/auth`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** it (expected: PASS), `pnpm exec vitest run --project int tests/int/auth-otp-send.test.ts tests/int/mock-outbox.test.ts`, then the full local check.
- [ ] **Step 5: Commit** `refactor(providers): add provider kinds and the closed SMS template type`, then `feat(providers): add the MSG91 SMS adapter`.

### Task N4: Resend adapter and the production refusals (PR `feat/resend-email`)

**Depends on:** N3.

**Files:**
- Create: `src/server/providers/resend-email.ts`, `resend-email.test.ts`, `src/server/notifications/sendable.ts`, `sendable.test.ts`.
- Modify: `src/server/env.ts` (+ test), `src/server/deps.ts` (+ test), `.env.example`, `docs/dev/deploy.md` (provider env per scope; Resend domain verification, open and click tracking off; DLT header, templates and URL whitelist), `docs/decisions/environments.md`, `docs/dev/architecture.md`, `CHANGELOG.md`.

**Interfaces:**
- Consumes: N3 `EmailProvider`, `ProviderError`, `classifyHttp`; `isMockForbidden()`.
- Produces:
  - `env.ts`: `RESEND_API_KEY` (`^re_[A-Za-z0-9_]{8,}$`), `EMAIL_FROM` (`^.{1,60} <[^<>@\s]+@[^<>@\s]+>$`), `EMAIL_REPLY_TO` (`z.email()`), all optional; `requireResendConfig(env): { apiKey; from; replyTo: string | null }`.
  - `resend-email.ts`: `createResendEmail(cfg: { apiKey: string; from: string; replyTo: string | null; fetchImpl?: typeof fetch }): EmailProvider` posts the ruled shape with header `Idempotency-Key: <idempotencyKey>` when given. 200 `{ id }` → `{ providerMessageId: id }`; errors go through `classifyHttp` (a 409 idempotency conflict counts as `permanent`, since the same key was already used for the same body).
  - `sendable.ts`: `isTestSender(from: string): boolean` (the address's domain is `resend.dev` or ends with `.resend.dev`); `assertSendable(deps: Pick<Deps, "sms" | "email">, channel: NotifyChannel): void` throws `MockInProductionError` (name only) when `isMockForbidden()` and the channel's provider has `kind === "mock"`, or the email provider is Resend with a test sender. `createResendEmail` exposes `readonly testSender: boolean` for this.
  - `deps.ts`: `EMAIL_PROVIDER=resend` → `createResendEmail(requireResendConfig(env))`; when `isMockForbidden()` and `isTestSender(EMAIL_FROM)` → throw "The Resend test sender is not allowed in production: verify a domain and set EMAIL_FROM".

- [ ] **Step 1: Write the failing tests**
  - `resend-email.test.ts`: the request goes to `https://api.resend.com/emails` with `Authorization: Bearer re_test…`, `Idempotency-Key: order:…:0:email`, and body `{ from, to: ["asha@example.com"], subject, html, text }`. With `replyTo` set, the body has `reply_to`. `{ id: "em_1" }` → `em_1`. 422 → `permanent`; 403 (domain not verified) → `permanent`; 429 and 503 → `retryable`; no error message contains the recipient.
  - `sendable.test.ts` (env stubbed): `VERCEL_ENV=production` with a mock SMS → `MockInProductionError`; with `msg91` → ok; Resend with `EMAIL_FROM="Aarvion <onboarding@resend.dev>"` → throws; outside production all of them pass.
  - `deps.test.ts`: production with real SMS and email but `EMAIL_FROM` at `resend.dev` → throws the test-sender message; production with a mock SMS → the existing mock error first; `EMAIL_PROVIDER=resend` outside production builds `email.kind === "resend"`.
- [ ] **Step 2: Run** `pnpm exec vitest run --project unit src/server/providers/resend-email.test.ts src/server/notifications/sendable.test.ts src/server/deps.test.ts src/server/env.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** it (expected: PASS), then the full local check.
- [ ] **Step 5: Commit** `feat(providers): add the Resend email adapter and refuse test senders in production`.

### Task N5: The notifications outbox store (PR `feat/notify-outbox`)

**Depends on:** N1.

**Files:**
- Create: `src/server/notifications/outbox.ts`, `tests/int/notify-outbox.test.ts`.
- Modify: `src/server/db/register-all.ts`, `tests/helpers/notify.ts` (`seedNotification`), `docs/dev/architecture.md` (the `notifications` collection row), `docs/dev/testing.md`, `CHANGELOG.md`.

**Interfaces:**
- Consumes: N1 types, `dedupeKey`, `retryAt`, `OUTBOX_TTL_MS`, `SEND_LEASE_MS`, `STALE_AFTER_MS`; `getDb`, `registerIndexes`.
- Produces:
  - `NOTIFICATIONS_COLLECTION = "notifications"`; indexes `dedupeKey_unique` (unique), `status_nextAttemptAt`, `status_leaseUntil`, `orderId_createdAt`, `expiresAt_ttl` (TTL 0).
  - ```ts
    type NotificationDoc = {
      _id: ObjectId; dedupeKey: string; type: NotifyType; channel: NotifyChannel;
      userId: ObjectId; orderId: ObjectId; vars: NotifyVars;
      status: "pending" | "sending" | "sent" | "skipped" | "dead";
      attempts: number; nextAttemptAt: Date; leaseUntil: Date | null;
      lastError: string | null;          // a fixed code: retryable | permanent | no_template | no_channel | outcome_unknown | stale | mock_in_production
      providerMessageId: string | null; toMasked: string | null;
      createdAt: Date; updatedAt: Date; sentAt: Date | null; expiresAt: Date;
    };
    ```
  - `enqueueNotification(i: { key: { orderId: ObjectId; seq: number | "refund" }; type: NotifyType; userId: ObjectId; vars: NotifyVars; now: Date; session?: ClientSession }): Promise<void>`: parses `vars` with `NotifyVars`, then for each channel runs `updateOne({ dedupeKey }, { $setOnInsert: doc }, { upsert: true, session })`, with `status "pending"`, `attempts 0`, `nextAttemptAt now` and `expiresAt now + 90 d`.
  - `claimNext(now: Date): Promise<NotificationDoc | null>`: `findOneAndUpdate({ status: "pending", nextAttemptAt: { $lte: now } }, { $set: { status: "sending", leaseUntil: now + SEND_LEASE_MS, updatedAt: now }, $inc: { attempts: 1 } }, { sort: { nextAttemptAt: 1 }, returnDocument: "after" })`.
  - `settle(id: ObjectId, now: Date, outcome: { kind: "sent"; providerMessageId: string; toMasked: string } | { kind: "skipped"; reason: "no_channel" | "no_template" } | { kind: "retry"; error: "retryable"; at: Date } | { kind: "defer"; at: Date; error?: "mock_in_production" } | { kind: "dead"; error: NotificationDoc["lastError"] }): Promise<boolean>`: conditional on `{ _id, status: "sending" }`. `defer` also runs `$inc: { attempts: -1 }`. `retry` sets `pending` and `nextAttemptAt`, and clears the lease.
  - `recoverExpiredLeases(now: Date): Promise<{ resent: number; lost: number }>`: `sending` with `leaseUntil ≤ now`. Email goes back to `pending` (`nextAttemptAt now`). SMS goes to `dead` with `outcome_unknown`. Each is a conditional update.
  - `listForOrder(orderId: ObjectId): Promise<NotificationDoc[]>` (tests and a later D view).

- [ ] **Step 1: Write the failing tests** (`tests/int/notify-outbox.test.ts`)
  - `enqueueNotification` writes two documents (`sms`, `email`) with the right `dedupeKey`s; calling it again with the same key writes nothing new (count stays 2) and does not throw.
  - Inside `client.withSession(s => s.withTransaction(…))` (a raw driver transaction, so the test does not wait for O2), an enqueue followed by a throw leaves no document, and an enqueue of an existing key inside a transaction commits the transaction (no abort).
  - A `vars` with an `items` key → zod error, nothing written.
  - `claimNext` returns the oldest due message and sets `sending`, `attempts: 1`; a message with `nextAttemptAt` in the future is not claimed; two parallel `claimNext` on one due message → one wins, the other gets `null`.
  - `settle` on a message no longer `sending` → `false`; `defer` keeps `attempts` unchanged overall.
  - `recoverExpiredLeases`: an expired SMS → `dead` `outcome_unknown`; an expired email → `pending`; an unexpired lease is untouched.
  - The stored document has no field whose value matches the seeded user's phone or email (scan all string values).
- [ ] **Step 2: Run** `pnpm exec vitest run --project int tests/int/notify-outbox.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** it (expected: PASS), then the full local check.
- [ ] **Step 5: Commit** `feat(notify): add the deduplicated notifications outbox`.

### Task N6: Sender and the notify cron (PR `feat/notify-sender`)

**Depends on:** N2, N4, N5. Reuses O13's `assertCronAuth` and `CRON_SECRET` if merged, and creates them otherwise (ruling).

**Files:**
- Create: `src/server/notifications/send.ts`, `src/app/api/cron/notify/route.ts`, `tests/int/notify-send.test.ts`, `tests/int/cron-notify-route.test.ts`; if absent, `src/server/security/cron-auth.ts` (+ `cron-auth.test.ts`).
- Modify: `vercel.json` (add `{ "path": "/api/cron/notify", "schedule": "* * * * *" }`, keeping O13's entry), `src/server/providers/mock-sms.ts` (the payload gains `text: fillDlt(…)` so `/dev/outbox` shows the rendered SMS), `docs/dev/architecture.md` (rate-limit key), `docs/dev/deploy.md` (the cron needs Pro), `CHANGELOG.md`; if absent, `src/server/env.ts` and `.env.example` (`CRON_SECRET`).

**Interfaces:**
- Consumes: N5 `claimNext`, `settle`, `recoverExpiredLeases`; N2 `renderSms`, `renderEmail`; N4 `assertSendable`, `MockInProductionError`; N3 `ProviderError`; N1 `verifiedDestination`, `NOTIFY_RATE`, `SEND_BATCH`, `STALE_AFTER_MS`, `retryAt`; `maskPhone`, `maskEmail`; `hitRateLimit`; `findUserById` (`auth/users.ts`, added here if missing: `(id: ObjectId) => Promise<UserDoc | null>`); `getDeps()`.
- Produces:
  - `sendDueNotifications(i: { now: Date; limit?: number }): Promise<{ sent: number; skipped: number; retried: number; deferred: number; dead: number; recovered: { resent: number; lost: number } }>`. It first runs `recoverExpiredLeases(now)`, then up to `limit` (default 50) rounds of `claimNext`, and for each message, in this order:
    1. `createdAt ≤ now − STALE_AFTER_MS` → `dead` `stale`;
    2. `assertSendable(deps, channel)` throws → log, then `settle` as `defer` to now + 10 minutes with `error: "mock_in_production"` (never `sent`, not counted as an attempt, so the message waits for a fixed config);
    3. user missing or `verifiedDestination` null → `skipped` `no_channel`;
    4. `hitRateLimit({ key: "notify:user:<id>:<channel>", ...NOTIFY_RATE })` refused → `defer` to `resetAt`;
    5. SMS: `deps.sms.send({ to, ...renderSms(type, vars) })`; email: `deps.email.send({ to, ...renderEmail(type, vars), idempotencyKey: dedupeKey })`;
    6. success → `sent` with `toMasked`; `ProviderError` `permanent` with message `no_template` → `skipped` `no_template`; other `permanent` → `dead`; `retryable` → `retryAt(attempts, now)` or `dead` once null.
    Each outcome logs one line: `notify <id> <type> <channel> <outcome> <errorName|->`.
  - `assertCronAuth(req: Request): void` (`HttpError(500, "server_misconfigured")` when `CRON_SECRET` is unset; `HttpError(401, "unauthorized")` on a wrong or missing header; `timingSafeEqual` on equal-length buffers).
  - `GET /api/cron/notify`: `await connection()`, `assertCronAuth(req)`, `sendDueNotifications({ now: getDeps().now() })` → 200 the counts.

- [ ] **Step 1: Write the failing tests** (`tests/int/notify-send.test.ts`, deps via `setDepsForTests` with recording fakes, clock from `tests/helpers/clock.ts`)
  - A user with a verified phone and email, plus one enqueued `order_placed` → one SMS with `templateId: "order_placed"` to `+91…`, one email with `idempotencyKey` equal to its `dedupeKey`, both `sent`, and `toMasked` `"+91******3210"`.
  - Email-only user → SMS `skipped` `no_channel`, no SMS call. A user whose phone changed after the enqueue → the SMS goes to the new number.
  - A marketing opt-out user (`consents.marketing.optedIn: false`) still gets both messages.
  - SMS `retryable` → `pending`, `nextAttemptAt` = now + 60 s; five retryable failures across advancing clocks → `dead`; `permanent` → `dead` at once; `no_template` → `skipped`.
  - **Review Focus 1:** a message claimed and then the run "crashes" (claim with no settle), with the clock advanced 61 s, then the next run → SMS `dead` `outcome_unknown` and the fake SMS is called once in total; the same for email → re-sent once with the same idempotency key. Two parallel `sendDueNotifications` over 20 due messages → each fake call happens once per message.
  - The 11th message to one user and channel within an hour → `pending` with `nextAttemptAt` at the window reset, attempts unchanged.
  - A message created 49 h ago → `dead` `stale`, no provider call.
  - **Review Focus 4:** `VERCEL_ENV=production` with `setDepsForTests({ sms: mockSms })` → no `sent`, the message stays `pending` (deferred), the log has `mock_in_production`, and `dev_outbox` is empty.
  - Logs: a `console` spy over the whole file never sees the seeded phone, the email, `9876543210` or `@example.com`.
  - `cron-notify-route.test.ts`: no header → 401; a wrong Bearer → 401; `CRON_SECRET` unset → 500; the right Bearer → 200 with the counts keys; `src/server/route-config.test.ts` stays green.
- [ ] **Step 2: Run** `pnpm exec vitest run --project int tests/int/notify-send.test.ts tests/int/cron-notify-route.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** it (expected: PASS), `pnpm exec vitest run --project unit src/server/route-config.test.ts`, then the full local check.
- [ ] **Step 5: Commit** `feat(notify): add the outbox sender and the notify cron`. Split seam if over 400 lines: `cron-auth.ts` and the route in a second PR.

### Task N7: FileStore listing (PR `feat/file-store-list`)

**Depends on:** none (wave 1).

**Files:**
- Modify: `src/server/providers/types.ts` (`FileStore.list`), `file-keys.ts` (`assertListPrefix`), `memory-files.ts`, `local-files.ts`, `blob-files.ts`, `file-store.ts` (delegate), and their tests `local-files.test.ts`, `blob-files.test.ts`; create `memory-files.test.ts`; `docs/dev/architecture.md`, `CHANGELOG.md`.

**Interfaces:**
- Produces:
  - `FileStore.list(prefix: "rx/" | "rx-staging/", opts: { cursor: string | null; limit: number }): Promise<{ items: { key: string; uploadedAt: Date }[]; cursor: string | null }>`. A `cursor` of null in the result means the end. `limit` is 1..1000.
  - `assertListPrefix(p: string): void`, which throws unless `p` is exactly `rx/` or `rx-staging/`.
  - Memory: `createMemoryFiles(opts?: { now?: () => Date })` records `uploadedAt` at put; `list` sorts keys, and the cursor is the last key returned.
  - Local: walks `<dir>/<prefix>` recursively, skips `*.type`, `uploadedAt` = `mtime`, sorted keys, cursor = last key; a missing folder → `{ items: [], cursor: null }`.
  - Blob: `list({ prefix, cursor: cursor ?? undefined, limit, token })` from `@vercel/blob`, mapping `pathname` and `uploadedAt`; `cursor` null when `!hasMore`.

- [ ] **Step 1: Write the failing tests**
  - Memory and local (shared cases): put `rx-staging/u1/a`, `rx-staging/u1/b`, `rx/u1/x.webp`; `list("rx-staging/", { cursor: null, limit: 1 })` → `a` with a cursor, then `b` with a cursor, then empty with `null`; `list("rx/")` never returns staging keys; `list("../")`, `list("rx")` and `list("")` throw; memory with an injected clock reports that `uploadedAt`; local skips `.type` files.
  - Blob (`vi.mock("@vercel/blob")` as the current tests do): `list` is called with the prefix, the token and the limit; `hasMore: false` → `cursor: null`.
- [ ] **Step 2: Run** `pnpm exec vitest run --project unit src/server/providers`. Expected: FAIL.
- [ ] **Step 3: Implement.** Check in `node_modules/@vercel/blob` that `list` accepts a private store's token and returns `uploadedAt` and record it in the PR. If it does not, stop and report: the sweep then needs the R4 records instead (a design change).
- [ ] **Step 4: Run** it (expected: PASS), `pnpm exec vitest run --project int tests/int/deps-file-store.test.ts`, then the full local check.
- [ ] **Step 5: Commit** `feat(files): list stored files by prefix with their upload time`.

### Task N8: Prescription file sweep and its cron (PR `feat/rx-file-sweep`)

**Depends on:** N7. Reuses or creates `assertCronAuth` (ruling).

**Files:**
- Create: `src/server/files/sweep.ts`, `src/app/api/cron/sweep/route.ts`, `tests/int/rx-sweep.test.ts`.
- Modify: `src/server/audit.ts` (`AuditAction` gains `"files.sweep"`), `src/server/db/register-all.ts`, `vercel.json` (`{ "path": "/api/cron/sweep", "schedule": "23 * * * *" }`), `docs/dev/architecture.md` (`sweep_state` row; "Orders and prescriptions" gains the sweep), `CHANGELOG.md`.

**Interfaces:**
- Consumes: N7 `FileStore.list`; `getDeps().files`; `PRESCRIPTIONS_COLLECTION`; `appendAudit`.
- Produces:
  - `SWEEP_AGE_MS = 3_600_000`; `SWEEP_LIMITS = { pages: 5, pageSize: 500, deletes: 200 }`; `SWEEP_STATE_COLLECTION = "sweep_state"` (`{ _id: "rx/" | "rx-staging/"; cursor: string | null; updatedAt: Date }`, no indexes).
  - `FINAL_KEY = /^rx\/([0-9a-f]{24})\/([0-9a-f]{24})\.(webp|pdf)$/`.
  - `sweepRxFiles(now: Date, limits = SWEEP_LIMITS): Promise<{ staging: { scanned: number; deleted: number }; final: { scanned: number; deleted: number; kept: number; malformed: number }; done: { staging: boolean; final: boolean } }>`. Staging first, then final, sharing one delete budget. For each page: keys with `uploadedAt > now − SWEEP_AGE_MS` are skipped. Final candidates are parsed with `FINAL_KEY` (no match → `malformed`, kept), then one `find({ _id: { $in } }, { projection: { _id: 1 } })`, and only ids not found are deleted. The cursor is saved after each page. When the budget runs out mid-page, the cursor is not advanced past that page, and the next run re-lists it (deletes are idempotent). Any thrown error stops the run and is rethrown after logging its name.
  - `GET /api/cron/sweep`: `await connection()`, `assertCronAuth(req)`, `sweepRxFiles(getDeps().now())` → 200 the counts. When anything was deleted, one `files.sweep` audit row with `{ stagingDeleted, finalDeleted, malformed }`.

- [ ] **Step 1: Write the failing tests** (`tests/int/rx-sweep.test.ts`, memory store with an injected clock)
  - A staging file 61 minutes old → deleted; one 59 minutes old → kept.
  - `rx/<u>/<id>.webp` 2 h old with no record → deleted; with a `prescriptions` record of that `_id` → kept; a record of that `_id` under another `userId` → kept; `rx/<u>/notanid.webp` → `malformed`, kept.
  - **Review Focus 5:** 1,200 young staging files and 3 old ones at the end of the listing with `{ pages: 1, pageSize: 500, deletes: 200 }` → the first run deletes 0 and saves a cursor; within three runs the 3 old files are gone and the cursor is back to null. 300 old orphans with `deletes: 200` → 200, then 100 on the next run.
  - The `prescriptions` find throws (spy) → the run rejects and no `rx/` file is deleted.
  - Running the sweep twice in parallel → every orphan is gone and no error is thrown.
  - An audit row `files.sweep` with counts only when deleted > 0; none on an empty run.
  - Route: 401 without the Bearer, 200 with it; `route-config.test.ts` green.
- [ ] **Step 2: Run** `pnpm exec vitest run --project int tests/int/rx-sweep.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** it (expected: PASS), then the full local check.
- [ ] **Step 5: Commit** `feat(rx): sweep orphaned prescription files hourly`.

### Task N9: Wire order events into the outbox (PR `feat/notify-order-events`)

**Depends on:** N5; O2, O6, O9, O10.

**Files:**
- Create: `src/server/notifications/enqueue.ts`, `tests/int/notify-order-events.test.ts`.
- Modify: `src/server/orders/orders.ts` (`applyTransition` calls the hook inside its transaction), `src/server/orders/place.ts` (the COD branch calls it inside the placement transaction), `src/server/orders/refunds.ts` (`markRefundProcessed` and the `processed` branch of `executeRefund` run their write, audit and `enqueueRefunded` in `withTransaction`), `docs/dev/architecture.md` ("Orders and prescriptions": the outbox rule), `AGENTS.md` (the Notifications invariant: "every order change that notifies enqueues in its own transaction"), `CHANGELOG.md`.

**Interfaces:**
- Consumes: N1 `notifyTypeFor`, `orderLink`; N5 `enqueueNotification`; O2 `OrderDoc`, `applyTransition`, `withTransaction`; O6 `placeOrder`; O9 `executeRefund`, `markRefundProcessed`; `getSiteEnv()`.
- Produces:
  - `enqueueOrderNotifications(i: { order: OrderDoc; from: OrderStatus | null; now: Date; session: ClientSession }): Promise<NotifyType | null>`: `type = notifyTypeFor({ from, to: order.status })`, and when non-null, `enqueueNotification({ key: { orderId, seq: order.statusHistory.length - 1 }, type, userId, vars: { number, link: orderLink(getSiteEnv().appUrl, number), courier: shipment?.courier ?? null, awb: shipment?.awb ?? null, trackingUrl: shipment?.trackingUrl ?? null }, now, session })`.
  - `enqueueRefunded(i: { order: OrderDoc; now: Date; session: ClientSession }): Promise<void>` (`seq: "refund"`, type `refunded`).
  - `applyTransition` calls `enqueueOrderNotifications({ order: after, from, now, session })` after its update and audit, in the same session. `placeOrder` (COD) calls it with `from: null` after `insertOrder`.

- [ ] **Step 1: Write the failing tests** (`tests/int/notify-order-events.test.ts`, `seedOrder` and `seedRx` from O2's helpers)
  - COD `placeOrder` → two `order_placed` documents keyed `…:0:sms` and `…:0:email`; a replayed `placeOrder` with the same `idempotencyKey` → still two.
  - A prepaid order, three parallel `capturePayment` calls → exactly two `order_placed` documents (seq 1).
  - Staff `confirm` → `rx_approved`; `hold` → `rx_rejected`; on hold → `confirm` → `hold` again → two `rx_rejected` per channel (seq differs).
  - Staff `ship` with `set: { shipment: { courier: "Bluedart", awb: "AWB12345", trackingUrl: "https://track.test/AWB12345" } }` → `shipped` vars carry all three; `trackingUrl: "http://…"` → the transition still commits and the vars have `trackingUrl: null`. Record this mapping in `enqueue.ts`: a non-https URL is dropped before `NotifyVars`, so a bad URL can never abort an order change.
  - `deliver` → `delivered`; customer `cancel` from `placed` → `cancelled`; system cancel of an unpaid `pending_payment` order → no document.
  - A cancelled paid order: `executeRefund` (fake gateway answers `processed`) → one `refunded` per channel; `markRefundProcessed` after a `requested` refund → one; called twice → still one.
  - An enqueue that throws inside `applyTransition` (spy) → the order status is unchanged and there is no audit row (the transaction aborted).
  - The vars of every document pass `NotifyVars`, and none holds a product name.
- [ ] **Step 2: Run** `pnpm exec vitest run --project int tests/int/notify-order-events.test.ts tests/int/order-store.test.ts tests/int/order-refunds.test.ts`. Expected: FAIL (new file), with O's own suites still green.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** it (expected: PASS), then the full local check.
- [ ] **Step 5: Commit** `feat(notify): enqueue order messages in the order change's transaction`. Split seam if over 400 lines: the refunds change in a second PR.

### Task N10: Restore the "We'll text and email you" copy (PR `feat/notify-copy`)

**Depends on:** N9; O7, O18.

**Files:**
- Modify: `src/server/orders/view.ts` (+ its test: `OrderView.notify`), `src/components/orders/order-copy.ts`, `order-detail.tsx`, `order-detail.test.tsx`, `docs/dev/architecture.md`, `CHANGELOG.md`.

**Interfaces:**
- Consumes: O7 `toOrderView`, `OrderView`; N1 `verifiedDestination`; O18 `OrderDetail`.
- Produces:
  - `OrderView.notify: { sms: boolean; email: boolean }`, from the order's user's verified channels (passed in by the route, which already has `auth.user`).
  - `notifyClause(n: { sms: boolean; email: boolean }): string | null` in `order-copy.ts`: "We’ll text and email you" / "We’ll text you" / "We’ll email you" / `null`, followed by " when your order is approved, then pack your medicines." (curly apostrophes, as the prototype's web copy).
  - The placed and pharmacist-check bodies append the clause.

- [ ] **Step 1: Write the failing tests**: both channels → the body ends with "We’ll text and email you when your order is approved, then pack your medicines."; phone only → "We’ll text you when…"; neither → no "We’ll" sentence; `findClaims` is `[]`; the view test maps `phoneVerifiedAt` to `notify.sms`.
- [ ] **Step 2: Run** `pnpm exec vitest run --project ui src/components/orders && pnpm exec vitest run --project unit src/server/orders`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** it (expected: PASS) and the full local check. **Visual** against `order.html` (Just placed).
- [ ] **Step 5: Commit** `feat(orders): tell the customer how they will hear about their order`.

### Task N11: Notifications end-to-end (PR `test/e2e-notifications`)

**Depends on:** N6, N10; O20.

**Files:**
- Create: `e2e/notifications.spec.ts`.
- Modify: `playwright.config.ts` (the e2e server env gains a generated `CRON_SECRET`, exposed to the spec through the same `process.env`), `docs/dev/testing.md`, `CHANGELOG.md`.

- [ ] **Step 1: Write the tests** (fresh email and its own `x-real-ip` per run; `collectConsoleErrors` empty):
  1. Sign in by email, then place a COD order through O20's flow. The order page shows "We’ll email you when your order is approved". `GET /api/cron/notify` with the Bearer → 200, and then `/dev/outbox?to=<email>` holds an email whose subject is "We have received your order AAR-…", whose text has `/order/AAR-` and whose html and text contain neither "Sacuwin" nor "₹".
  2. Cancel the order from its page, run the cron again → a second email, subject "Order AAR-… is cancelled"; running the cron a third time adds nothing.
  3. The same account adds and verifies a phone (if P1 is not merged, the spec seeds `phoneVerifiedAt` through a dev-only helper already used by auth e2e, or the case is skipped with a reason in the PR) → the next order's SMS shows up in `/dev/outbox?to=+91…` with `templateId: "order_placed"`.
- [ ] **Step 2: Run** `pnpm test:e2e e2e/notifications.spec.ts` on the seeded e2e database. Expected: PASS (a failure is a bug to fix in this PR, test first).
- [ ] **Step 3: Commit** `test(e2e): cover order notifications through the outbox`.

### Task N12: Phase N finish-review gate (PR `fix/n-finish-review`)

**Files:** whatever the review finds. Also `docs/decisions/phase-n-ledger.md` (the execution ledger persisted), `docs/decisions/rulings.md` (provisional rulings the owner confirmed or changed), `docs/handoff.md` (Current state; deploy blocker 1 now reads "SMS and email need DLT and a verified domain"; owner actions 2 and 3 updated with the 8 templates and URL whitelisting), `CHANGELOG.md`.

- [ ] **Step 1:** A fresh reviewer (most capable model) reads `<N1 base>..main` against this plan and `docs/requirements.md` §5.7, using Review Focus 1–5 as the checklist. It also checks: every `/api/cron/*` handler (`connection()`, `assertCronAuth`, counts only); every `console.*` in `src/server/notifications`, `providers/msg91-sms.ts`, `providers/resend-email.ts` and `files/sweep.ts` (ids and error names only); every template (no Rx content, no marketing); and that no order change that notifies runs outside a transaction.
- [ ] **Step 2:** VISUAL on the rendered emails (each type, saved from `/dev/outbox` as HTML) at 390 px in a browser and with a screen reader's reading order; the order page's restored clause against `order.html`.
- [ ] **Step 3:** Fix the findings test-first, one commit each; keep the PR ≤ 400 lines or split it.
- [ ] **Step 4:** Smoke on a preview, recorded in the PR body: with a Resend key and a verified domain, if the owner has one, one real order email to a team address; otherwise Resend test mode to the account owner's address on a preview only. With DLT ready, one real SMS per template to a team number; otherwise it is marked blocked on owner action 3. If the smoke shows a different MSG91 or Resend request shape, fix it test-first.
- [ ] **Step 5: Commit** `fix(notify): apply the phase N finish-review fixes`.

## After this plan

- **D (admin):** a staff view of `notifications` per order (type, channel, status, `toMasked`, `lastError`) and a "resend" action for `dead` email rows only (a new `dedupeKey` suffix `:r<n>`; never for SMS with `outcome_unknown` without staff confirmation); staff `ship` passes `shipment` in `applyTransition`'s `set`; every D route that changes an order goes through `applyTransition`, so messages need no D code.
- **P1:** if the owner wants a per-channel preference, `resolveDestination` reads it; data export lists the user's `notifications` (no destinations stored); account deletion removes `notifications` by `userId`, and prescription deletion leaves files for the sweep.
- **H:** the H4 gate refuses `SMS_PROVIDER=mock`, `EMAIL_PROVIDER=mock`, a `resend.dev` sender, a missing `MSG91_TEMPLATES.otp` and a missing `CRON_SECRET`; log redaction covers `+91\d{10}` and email patterns as a second line of defence.
- **Owner:** DLT registration (entity, the six-letter header, the 8 templates verbatim from `docs/dev/runbooks/register-sms-templates.md`, the site URL whitelisted), the MSG91 account and auth key, a domain verified in Resend (SPF, DKIM, DMARC) with open and click tracking off, and Vercel Pro for the one-minute cron.
