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
| `SMS_PROVIDER`, `EMAIL_PROVIDER`, `PAYMENTS_PROVIDER`, `FILE_STORE` | `msg91`, `resend`, `razorpay`, `blob` (once built) | `mock`, `mock`, `fake`, `memory` |
| `ALLOW_MOCKS_IN_PROD_BUILD` | unset | `1` |
| Provider keys (MSG91, Resend, Razorpay, Blob) | names defined by the N, O and R phases | test keys |

`VERCEL_ENV` and `NODE_ENV` are set by the platform.

**Build-time database (UI plan Task 7, ruling C11):** pages prerender from the DB, so
every Vercel scope needs `MONGODB_URI` and `MONGODB_DB` at build time, a seeded database, and
Atlas network access for Vercel builds. An empty catalogue throws `CatalogueEmptyError` and fails
the build instead of deploying an empty store. Seed the preview database before UI Task 9 merges,
and `aarvion_prod` before the first production deploy. Redeploy after a direct database edit.

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

- **H4 production gates:** a startup assertion that `VERCEL_ENV=production` implies
  `MONGODB_DB=aarvion_prod`; `assertLegalConfigComplete()` (in `src/config/site.ts`, UI plan Task 9; the function exists, the call does not yet) called from
  `instrumentation.ts` in production, with `SITE_CONFIG` filled with the drug licence numbers,
  registered pharmacist, grievance officer, GSTIN and customer care details.
- **Index drift detection** (compare live index options with the registry) before the H5
  deploy ([docs/decisions/db.md](../decisions/db.md)).
- **H5 production deploy and runbook**, including how to run `db:indexes` in production.
- Security headers (CSP) and log redaction; privacy rights and retention (DPDP Act); the
  Lighthouse CI gate (mobile ≥ 90, LCP < 2.5 s, CLS < 0.1).
- Online payments stay hidden until live Razorpay keys exist.

## If a deploy fails

See [runbooks/handle-a-failed-deploy.md](runbooks/handle-a-failed-deploy.md) (planned).
