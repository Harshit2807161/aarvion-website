# Aarvion Pharmaceuticals — commercial website plan

## Context
Aarvion Pharmaceuticals (New Delhi) needs a commercial B2C pharma website. Customers:
- log in with an OTP;
- manage their profile and addresses;
- upload a prescription;
- add Aarvion products to a cart;
- check out at **MRP − ₹20**.

Product photos come from a shared Drive folder. Only Sacuwin 50/100/200 carry Aarvion branding. 8 more are Win2Age-era packs of Aarvion products (Aarvion used to sell under Win2Age), plus 1 probable (Mucohelp). That gives **11 of 31 active catalogue products with photos**. The other 20 stay off the site for now but must be documented.

The look takes cues from the user's `qtways-website` (fonts/style) and from Steris (feature list, banners, done much better), in a soothing green-and-white palette. The user's process:
1. Requirements, style guide and fonts settled through **iterative refinement, approved before the full build**.
2. Development in a new repo `Harshit2807161/aarvion-website` with best practices and **unit + integration tests in every PR**.
3. **I merge the PRs.** The user explicitly authorized this, which overrides the default ask-before-merge rule for this repo.
4. Hosting on Vercel.
5. The **tech stack is debated with options** at its own stage.

## Decisions made with the user
| Topic | Decision |
|---|---|
| Payment | Razorpay (test mode until Aarvion's KYC) **+ cash on delivery** |
| OTP login | Customer chooses **mobile SMS or email** |
| Orders/Rx | **Admin dashboard**: pharmacist approves/rejects Rx, staff move order statuses, edit products/MRP |
| Logo | **Redraw** the green swoosh + AARVION wordmark as SVG from the pack photos, for approval |
| Delivery | All India, **free** |
| Notifications | **Email + SMS** on order placed, Rx approved/rejected, shipped, delivered |
| Domain | Vercel URL for now |
| Framework (decided early, 2026-11-16) | **Next.js 16 App Router + TypeScript**. The rest of the Stage 4 sub-choices are still to be confirmed. |
| Images | Composio's `GEMINI_GENERATE_IMAGE` turned out to be disabled on Composio's side, so round 1 ran inside Figma: **Gemini 3.1 Flash Image vs GPT Image 2.5** (Figma file `dlvnZAbqR9Vbnk3Sg7Eixi`). The user picks one. |
| "font green" | Show 3 treatments: green headings / dark-green text overall / green accents only |
| Pricing | Price = MRP − ₹20. MRP comes from the back of the pack; **₹404 if not found** |
| Missing products | Leave them off the site; document them |
| qtways | **Reference only.** It has bugs, so nothing is ported; all code is written fresh |
| Design | `ui-ux-pro-max` skill drives the design-system decisions |

## Product data (MRP read off pack backs, checked at full resolution)
| Product | Pack | MRP | Price | Photos |
|---|---|---|---|---|
| Sacuwin 50 / 100 / 200 | 14 / 14 / 7 tabs | 281 / 407 / 290 | 261 / 387 / 270 | Aarvion (Sacuwin 50 includes the misfiled "Preloton-D (3)") |
| Bemptor-180 | 10 tabs | 380 | 360 | Win2Age |
| Bemptor-R40 | 10 tabs | 630 | 610 | Win2Age (tiny print; OCR said 650) |
| Vildage-M 50/500 | 15 tabs | 185 | 165 | Win2Age (50/1000 has no photo) |
| Hyloage / Sysnet Ultra eye drops | 10 ml | 425 / 416 | 405 / 396 | Win2Age |
| Caftop / Oloage-KT eye drops | 5 ml | 263 / 209 | 243 / 189 | Caftop unmarked / Win2Age |
| Mucohelp (probable) | 10 tabs | 209 | 189 | Win2Age, back panel only |

Sources are in the session scratchpad: `aarvion_mapping.json`, `ocr.json`, `catalogue.json` and the `imgs/` folder. Stage 0 copies them into the project.

---

## Stage 0 — Project folder and documentation
- Create `/Users/harshi/aarvion/` and run `git init`.
- `docs/catalogue.md`: all 32 catalogue lines by therapy area, each marked **Listed** or **Missing photo** (Fildol marked discontinued), with compositions.
- `docs/missing-products.md`: the 20 products without photos, plus Vildage-M 50/1000, with what's needed to add each later.
- `data/products.json`: the 11 products with category, composition, pack, MRP, schedule/Rx flag, photo IDs, hero image choice and `imageSource` (aarvion | win2age | placeholder). Prices are derived, not stored.
- `assets/products/original/`: the 32 source photos.

## Stage 1 — Requirements (approval gate 1)
I write `docs/requirements.md` and publish it as a page for the user to review.

**Contents:**
- sitemap;
- customer flows;
- admin flows;
- non-functional targets: Lighthouse mobile ≥ 90, LCP < 2.5 s, WCAG 2.2 AA, works from 360 px;
- compliance notes.

**Feature set:** the user's asks plus what the Steris shop (sterispharma.co.in) does well. sterisindia.com itself is only an enquiry catalogue.
- "Requires a valid prescription" badge.
- Cart split into Rx and non-Rx items.
- At checkout: upload a new Rx or choose an earlier one.
- Checkout summary: MRP total, then discount (₹20 × qty), then free delivery, then total payable.
- COD or online payment, with a review step before placing.
- Order statuses, invoice download, cancel with a reason before dispatch, re-order.
- PDP fields: composition, manufacturer, pack, MRP struck through, price, "inclusive of taxes", info sections.
- Policy pages, FAQ, contact form, WhatsApp/call buttons, trust and stats bands, shop by therapy area.

**Business-rule questions to close in this round:**
- Rx validity window: proposed 6 months.
- Max quantity per item and per order.
- COD cap.
- Return policy.
- Payment timing: proposed pay first, refund if the Rx is rejected.
- GST invoice issuer and HSN/GST rate.
- Staff roles and names.
- Licence numbers for the footer.

## Stage 2 — Visual direction and style guide (approval gate 2, iterative)
Each round is a private published HTML page with 2–3 side-by-side options. The user picks or comments, and I refine. Rounds:
1. **Palettes.** All white-text buttons must pass 4.5:1 contrast.
   - pixel77-derived sage: `#F4F8F2` / `#E3F1E6` / `#2E7D5B` / `#14432F`, rare lime `#C6DD40`;
   - ui-ux-pro-max "Pharmacy Green": `#15803D` / `#F0FDF4` / `#14532D`;
   - deep forest: `#1C443C` / `#042C23`.
   - Each is shown with the 3 "font green" treatments.
2. **Type.** Pairings shown on a real product card and hero:
   - Playfair Display + Inter (qtways);
   - Figtree + Noto Sans;
   - Sora + Inter;
   - a geometric sans (Manrope-style) with two-tone headlines.
3. **Logo.** SVG redraw: full, monochrome, icon-only.
4. **Banner art direction.** 3 directions:
   - Aarvion packs on soft sage pedestals with leaves (pixel77 #10 Belta);
   - clean studio product shot;
   - abstract molecule/leaf gradient.
   - Process: run 1 prompt per direction through **both** Gemini and Figma AI, then the user picks the tool and direction, then I generate the full set.
   - Format: 1920×720 desktop + 750×900 mobile, art-directed; text stays in HTML; alt text on every slide.
   - I ask before any bulk generation that uses credits.
5. **Style guide v1.** Tokens (colour scales 50–950, type scale, spacing, radius, shadow, motion) and core components (buttons, inputs, OTP field, product card, cart line, Rx badge, stepper). Saved via `ui-ux-pro-max` as `design-system/MASTER.md`.

## Stage 3 — High-fidelity mockups (approval gate 3: "approve before going all in")
- **Clickable HTML prototype, mobile and desktop:**
  - home, category, product page, OTP login (SMS/email toggle), profile and addresses, Rx upload;
  - cart drawer, checkout steps, order confirmation, order history;
  - admin: Rx queue, order detail, product edit.
- Iterate until approved.

## Stage 4 — Tech-stack debate (approval gate 4)
I present a comparison table and the user decides. My current recommendation is in **bold**.

**App framework** (all three are TypeScript + React with a Node backend on Vercel):
- **A. Next.js 16 App Router, full-stack.**
  - Server-rendered/static product pages, so WhatsApp and Google link previews work.
  - Product pages refresh instantly after an admin MRP edit (tag revalidation).
  - Best LCP on mid-range Android; one origin, so cookies are simple.
  - Cost: the caching model takes learning.
- B. Vite SPA + Vercel Functions (qtways style).
  - Simplest concepts, smallest runtime.
  - Client-rendered, so weak SEO and broken link previews; slower LCP; more DIY.
- C. React Router v8 framework mode.
  - Good SSR and less framework magic.
  - Fewer commerce-on-Vercel examples; image pipeline and sitemap are hand-rolled.
- C2. Rejected: a separate Express host means cross-site cookies and two pipelines.

**Data access:**
- **Native `mongodb` driver + zod** (one schema shared by validation, forms and data access; explicit atomic updates);
- Mongoose 9 as the familiar fallback;
- Prisma: no MongoDB support in v7.

**Messaging:**
- SMS: **MSG91** (DLT-native) vs Twilio vs Firebase.
- Email: **Resend** vs SES.

**Prescription file storage:**
- **Vercel Blob, private store**, files streamed through ownership-checked handlers;
- S3 Mumbai as a fallback if data must stay in India;
- Cloudinary and GridFS rejected.

**Auth and rate limiting:**
- **Database-backed sessions** (revocable; staff idle timeout) vs JWT;
- rate limiting: **Mongo TTL counters** + Vercel WAF/BotID vs Upstash.

**UI:**
- **Tailwind 4 + shadcn/ui** (accessible Radix primitives) plus our own brand components;
- CSS transitions instead of framer-motion/Swiper on the storefront;
- TanStack Query for shared cart/profile state.

**Testing:**
- Vitest + React Testing Library (unit);
- Vitest + `MongoMemoryReplSet` + MSW, calling route handlers directly (integration);
- Playwright (end-to-end);
- Lighthouse CI on previews.

**Toolchain:** TS 6.0.x (TS 7 lacks typescript-eslint support), Node 24 on Vercel, pnpm 12, ESLint 10 + Prettier.

## Stage 5 — Build, PR by PR
**Repo setup.** The plan's approval covers these GitHub steps:
- create the repo;
- add Actions CI (lint, typecheck, unit, integration, build, end-to-end smoke, PR-title and branch-name checks, PR-size check);
- branch protection on `main`: required checks, linear history, 0 approvals.

**Rules for every PR:**
- branch `type/short-desc`;
- Conventional Commits, squash merge;
- under ~400 changed lines;
- tests in the same PR;
- Vercel preview;
- no Co-Authored-By trailer.
- I merge once all required checks are green.

**Data model** (integer paise; price derived as MRP − 2000):
- users (phone/email, verified flags, addresses, role, consents);
- otp_challenges (HMAC-hashed code, attempts, TTL);
- sessions (hashed token);
- categories;
- products (composition, pack, mrpPaise, schedule/rxRequired, images, imageSource);
- prescriptions (private file reference, review record with doctor and pharmacist registration numbers);
- carts;
- orders (snapshot, totals, payment, rxStatus, statusHistory, shipment);
- webhook_events;
- notifications (outbox with dedupe);
- rate_limits;
- audit_logs;
- counters.

**Order state machine:** pending_payment, then placed, confirmed, packed, shipped, delivered. Side states: on_hold (Rx rejected) and cancelled. Dispatch is blocked on the server unless the Rx is approved and payment is paid or COD.

**PR phases** (about 40 PRs; independent tracks run in parallel):

| Phase | What ships |
|---|---|
| **F** Foundation | scaffold; CI and guards; DB client, indexes and Docker replica set; Playwright harness with mock providers; design tokens; overlay/form primitives; layout shell; legal pages |
| **C** Catalogue | schema, pricing and seed; cached queries; home and category; product page with SEO and JSON-LD; search |
| **A** Auth | rate limiter; OTP challenges; send/verify endpoints; sessions, guards and audit; login UI (SMS/email); profile and channel linking; address book |
| **K** Cart | cart API with guest merge; shared cart store and drawer |
| **R** Prescriptions | file validation (magic bytes, sharp re-encode, PDF checks); private storage and API; upload UI |
| **O** Orders and payments | order domain; COD placement (idempotent, priced on the server); checkout stepper; order history; Razorpay order + verify; webhook; checkout UI and reconcile cron |
| **N** Notifications | outbox and cron; MSG91; Resend + email templates; event wiring |
| **D** Admin | shell and roles; Rx review API and UI; orders API and UI; products API and UI (MRP edit, image swap, "needs photo swap" filter) |
| **H** Hardening | security headers and log redaction; privacy rights and retention; Lighthouse CI gate; production gates; production deploy and runbook |

**Critical path:** F1 → F2 → F3 → A1 → A2 → A3 → A4 → K1 → O2 → O5 → O6 → O7 → H4 → H5. Pure modules (pricing, file validation, order domain, providers) start early, in parallel.

**Security and compliance built in:**
- Rx gating enforced on the server;
- private Rx files with EXIF stripped;
- no Rx content in messages or logs;
- append-only audit log;
- hashed single-use OTPs, rate limits and BotID;
- amounts computed on the server, Razorpay signatures checked, webhooks deduplicated;
- zod on every input; CSP;
- footer shows licence numbers, pharmacist and grievance officer;
- product pages carry the Legal Metrology declarations;
- consent and retention designed for the DPDP Act.

**Performance:**
- static, CDN-served catalogue;
- `next/image` AVIF;
- content-hashed product images (Win2Age→Aarvion swaps bust caches);
- self-hosted variable fonts (≤ 2 families);
- first-load JS on product pages: the original 150 KB target was replaced on 2026-11-27 by enforced ratchets, home 175 kB and product 170 kB (`docs/decisions/rulings.md`);
- functions in Mumbai (`bom1`) next to Atlas Mumbai.

## Stage 6 — Deploy
Production on Vercel. Production smoke (below). Online payments stay hidden until live Razorpay keys exist.

## What the user needs to provide (needed for go-live, not for building)
| Item | Why | When |
|---|---|---|
| **A domain** (cheap is fine; the site can stay on `vercel.app`) | Email OTP and email notifications can't reach customers from an unverified sender | Before email goes live |
| **DLT registration** (sender ID + 6 SMS templates) | Indian law; no SMS OTP or order SMS works without it, whatever the provider | Start now (takes days) |
| **Vercel Pro team** + GitHub link; **MongoDB Atlas** (Mumbai) | Hobby is non-commercial and its cron runs once a day; I have no Vercel/Atlas login | Before Stage 5 previews |
| **Razorpay test keys**, later KYC + live keys | Online payments | Test keys by the O phase |
| **Drug licence / pharmacist / grievance officer details**, GSTIN | Legal display; Razorpay KYC; Rx review | Before launch |

Until these arrive, development and previews use mock SMS/email (an on-screen dev outbox), a fake payment gateway, and Razorpay test mode.

## Risks
- **Legal:** selling Schedule H drugs online needs a retail licence or a licensed dispensing partner, plus a pharmacist. The admin Rx gate supports this, but legal confirmation is the user's responsibility.
- **Placeholder photos:** some show the Win2Age logo. Use front shots; `imageSource` tracks which photos need swapping.
- **Copy:** no therapeutic claims (Drugs and Magic Remedies Act); category names stay descriptive.

## Verification
- **Every PR:**
  - lint, typecheck, unit, integration and Playwright smoke in CI;
  - Vercel preview with Playwright smoke + Lighthouse budgets;
  - I show the command output in each PR.
- **Locally:**
  - `pnpm db:up` (Docker replica set on colima), `pnpm db:indexes && pnpm seed`, `pnpm dev`;
  - read OTPs at `/dev/outbox`;
  - `pnpm test:unit`, `pnpm test:int`, `pnpm test:e2e`.
- **Manual end-to-end script before each phase closes:**
  - SMS login and email login; profile and address; upload Rx; add 2 products;
  - COD order → admin approves Rx → notifications in outbox → ship with AWB → delivered;
  - prepaid test-card order → Rx rejected → on hold → refund.
- **Production smoke:** pages load; real OTP to a team number; staff COD test order then cancelled; security headers; Rich Results test; WhatsApp link preview; Lighthouse.

## How I'll run it
- After approval, I start with Stage 0 + Stage 1 + Stage 2 round 1 (palettes, type, banner tool comparison) and stop for feedback at each gate.
- Every gate is a hard stop.
- Each build phase gets its own detailed implementation plan before coding.
