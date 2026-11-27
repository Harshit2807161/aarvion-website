# Deploy

**Status (2026-11-19): nothing is deployed.** No Vercel project or Atlas cluster exists yet; both
wait on owner actions ([handoff.md](../handoff.md#open-owner-actions-and-blockers)). Everything
on this page is the plan, assembled from `docs/decisions/` and the plans, and is **not verified
here**.

## Target

- **Vercel**, on a Pro team linked to the GitHub repo (the Hobby plan does not allow commercial
  sites, and its cron runs once a day). Functions in Mumbai (`bom1`), next to the database. Both
  facts come from the [project plan](../plan/project-plan.md) ("What the user needs to provide",
  "Performance") and are not verified here.
- **MongoDB Atlas**, Mumbai region.
- Real providers: MSG91 (SMS, needs DLT registration), Resend (email, needs a verified domain),
  Razorpay (test keys first, live keys after KYC), Vercel Blob (private) for prescription files.
  None is implemented yet; see [setup.md](setup.md#environment-variables).
- The site may start on its `vercel.app` URL; email needs a domain.

## Environments

| Scope | `VERCEL_ENV` | Database | Providers | `ALLOW_MOCKS_IN_PROD_BUILD` |
| --- | --- | --- | --- | --- |
| Production | `production` | `MONGODB_DB=aarvion_prod` | real only | never set |
| Preview | `preview` | a separate preview database (another `MONGODB_DB`, or another Atlas project) | mocks allowed | `1`, in the Preview scope only |
| Local | unset | `aarvion` (dev), `aarvion_e2e` (e2e) | mocks | e2e build only |

Rules ([docs/decisions/environments.md](../decisions/environments.md)): set `MONGODB_URI` and
`MONGODB_DB` per scope; never put `ALLOW_MOCKS_IN_PROD_BUILD` in Production or in "All
Environments"; keep Vercel Deployment Protection on for previews. A mock OTP is written to the
`dev_outbox` of whatever database the deploy points at, so a mocks-enabled deploy on the
production database would expose real customers' codes. `isMockForbidden()` therefore also
refuses mocks whenever the database is `aarvion_prod`.

## Environment variables per scope

| Name | Production | Preview |
| --- | --- | --- |
| `MONGODB_URI` | Atlas production cluster | preview cluster or project |
| `MONGODB_DB` | `aarvion_prod` | e.g. `aarvion_preview` |
| `OTP_PEPPER` | its own 64-hex secret | its own, different secret |
| `APP_URL` | the production URL (also the base for Open Graph and icon URLs; unset falls back to `http://localhost:3000`) | set it, or shared links point at localhost |
| `SMS_PROVIDER`, `EMAIL_PROVIDER`, `PAYMENTS_PROVIDER` | `msg91`, `resend`, `razorpay` (once built) | `mock`, `mock`, `fake` |
| `FILE_STORE` | `blob` | `blob` too: `memory` and `local` are refused whenever `VERCEL_ENV` is set, because files must persist across functions |
| `BLOB_READ_WRITE_TOKEN` | the production private Blob store's token | the preview store's token (a separate store, never production's) |
| `ALLOW_MOCKS_IN_PROD_BUILD` | unset | `1` |
| Provider keys (MSG91, Resend, Razorpay) | names defined by the N and O phases | test keys |

`VERCEL_ENV` and `NODE_ENV` are set by the platform.

**Build-time database (UI plan Task 7, ruling C11):** pages prerender from the DB, so
every Vercel scope needs `MONGODB_URI` and `MONGODB_DB` at build time, a seeded database, and
Atlas network access for Vercel builds. An empty catalogue throws `CatalogueEmptyError` and fails
the build instead of deploying an empty store. The `(store)` layout (`src/app/(store)/layout.tsx`, UI Task 9) renders the footer from the live categories, so from that PR on every customer page build reads the DB (`/api/*` and `/dev/*` sit outside `(store)` and do not; the 404 page reads the same cached categories for its chrome). **Seed the Preview database before that PR merges into a Vercel-connected repo** (no Vercel project exists yet, so CI, which seeds its own Mongo, is the only build today); otherwise Preview deploys fail closed. Seed `aarvion_prod` before the first production deploy: `pnpm db:indexes && pnpm seed` with that scope's `MONGODB_URI` and `MONGODB_DB` exported. Redeploy after a direct database edit.

## Prescription file store (Vercel Blob, private)

- Create **two private Blob stores**, one connected to the Production scope and one to Preview,
  so preview uploads never land beside real prescriptions. Connecting a store sets
  `BLOB_READ_WRITE_TOKEN` in that scope; set `FILE_STORE=blob` there as well (expose both at
  build time too).
- Create the production store in the Mumbai region (`bom1`) if Vercel offers it, next to the
  functions and the database. Whether prescription files must stay in India is the owner's legal
  call; S3 Mumbai is the project plan's fallback (provisional ruling, Phase K+R plan).
- **Build gate:** Vercel runs `pnpm vercel-build` (`scripts/vercel-build-gate.ts`, then `next
  build`), which fails the build when `FILE_STORE` is not `blob` or `BLOB_READ_WRITE_TOKEN` is
  missing, naming the keys only. At runtime the same mistake fails only file access with an
  `EnvError` (the store resolves lazily), never login.
- Blobs are written `access: "private"` with exact keys (`rx/<userId>/<rxId>.<ext>`,
  `rx-staging/…`) and no overwrite; they are read only through the app's ownership-checked
  handlers. Never hand out a blob URL, `downloadUrl` or a read-capable token.
- **TODO (R5, the route that calls `checkRxFile`): make the PDF check deployable.** The check runs
  `src/server/prescriptions/pdf-worker.mjs` in a worker thread, and Next emits that file as a plain
  asset (`.next/server/assets/pdf-worker.*.mjs`) whose `import "pdf-lib"` is resolved at run time.
  Nothing bundled imports pdf-lib, so file tracing will not copy `pdf-lib` and its dependencies
  (`@pdf-lib/standard-fonts`, `@pdf-lib/upng`, `pako`, `tslib`) into the function. R5 must add
  `outputFileTracingIncludes` for the upload route (or `serverExternalPackages: ["pdf-lib"]` plus a
  static import so it is traced), set the function's `maxDuration` and memory (a hostile object
  stream can take several hundred MB before the 1 s scan timeout fires), keep the upload rate
  limit, and add a Vercel-preview smoke test that uploads a one-page PDF and expects it accepted.
  Until then every PDF would fail closed (refused as `corrupt`) in production.
- Never set `DEBUG` (or `NEXT_PUBLIC_DEBUG`) containing `blob` on a Vercel scope: the SDK then logs
  pathnames and request headers.

## First deploy (planned)

1. Owner: create the Vercel Pro team and project linked to the repo, and the Atlas cluster
   (Mumbai) with a database user and network access for Vercel.
2. Set the env vars above per scope.
3. From a checkout with dev dependencies (`tsx` is a devDependency), point the shell at the
   target database and prepare it:
   `MONGODB_URI=… MONGODB_DB=aarvion_prod pnpm db:indexes && MONGODB_URI=… MONGODB_DB=aarvion_prod pnpm seed`.
4. Deploy `main`. Check `GET /api/health` returns 200 with `"status":"ok"` and `"db":"ok"`.
5. Run the production smoke from the project plan: pages load; a real OTP reaches a team number;
   a staff COD test order is placed, then cancelled; security headers present; Rich Results test
   and a WhatsApp link preview pass; Lighthouse.

`/api/health` answers with one of these bodies; every body also carries `"version"` (for example
`{"status":"ok","version":"0.1.0","db":"ok"}`), so match fields, never the whole string:

| Fields | Status | Meaning |
| --- | --- | --- |
| `status: "ok", db: "ok"` | 200 | env valid, DB pinged within 3.5 s |
| `status: "ok", db: "skipped"` | 200 | no `MONGODB_URI` outside production |
| `status: "error", db: "unconfigured"` | 503 | no `MONGODB_URI` in a production-like runtime |
| `status: "error", db: "misconfigured"` | 503 | an env var is invalid (the log names the key) |
| `status: "degraded", db: "down"` | 503 | the DB did not answer the ping |

## Production gates (phase H, planned)

Nothing below exists yet; each lands before or with the production deploy.

- **H4 production gates:**
  - refuse a production build while `PENDING_ROUTES` (`src/config/routes.ts`) is non-empty: `/cart`,
    `/account` and `/account/prescriptions` are linked from the chrome and 404 until K, R and P build
    them (a unit test keyed on `VERCEL_ENV=production`, or an `instrumentation.ts` check);
  - a Sign out action must exist (account pill menu or `/account`) before deploy: nothing calls
    `POST /api/auth/logout` yet, so a signed-in shopper cannot end the 30-day sliding session;
  - security headers (`next.config.ts`): CSP, `frame-ancestors 'none'` (`/login` can be framed
    today), `nosniff` and HSTS;
  - a startup assertion that `VERCEL_ENV=production` implies `MONGODB_DB=aarvion_prod`;
  - `APP_URL` must be set, and must not be localhost, in production. An unset or invalid value
    silently gives a localhost `metadataBase`, so shared links and Open Graph images would
    point at localhost;
  - `assertLegalConfigComplete()` (in `src/config/site.ts`, UI plan Task 9; the function exists,
    the call does not yet) called from `instrumentation.ts`. Gate it on
    `VERCEL_ENV === "production"`, not `NODE_ENV` (Preview builds also run with
    `NODE_ENV=production`). `SITE_CONFIG` must be filled with the drug licence numbers,
    registered pharmacist, grievance officer, GSTIN, and both a customer care phone and email
    (a partial pair counts as pending).
  - The gate does not see policy facts that live only in page copy. Before launch, replace each
    `<Pending />` in `src/app/(store)/legal/` with the owner's text: the privacy policy's data
    storage location and retention periods (handoff owner action 23), and the terms of use's
    liability limits and governing law (owner action 24).
- **Go-live: online payments.** `SITE_CONFIG.onlinePayments` (`src/config/site.ts`) is `false`, so
  the footer's payment line says only "Cash on delivery", and the terms of use offer only cash on
  delivery and name no online method. Once live Razorpay keys exist and prepaid checkout works
  (plan Stage 6), flip it to `true` in the same PR: the footer line then adds UPI, cards and
  netbanking through Razorpay, and the terms switch to paying online through Razorpay or by cash
  on delivery, with the pay-first and refund rule. Never flip it earlier; the site must not claim
  methods that do not work.
- **Index drift detection** (compare live index options with the registry) before the H5
  deploy ([docs/decisions/db.md](../decisions/db.md)).
- **H5 production deploy and runbook**, including how to run `db:indexes` in production.
- Security headers (CSP) and log redaction; privacy rights and retention (DPDP Act); the
  Lighthouse CI gate (mobile ≥ 90, LCP < 2.5 s, CLS < 0.1).
- Online payments stay hidden until live Razorpay keys exist.

## If a deploy fails

See [runbooks/handle-a-failed-deploy.md](runbooks/handle-a-failed-deploy.md) (planned).
