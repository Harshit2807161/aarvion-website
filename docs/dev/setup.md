# Local setup

## Prerequisites

- **Node 24** (`.nvmrc`; `package.json` has `engines.node >=24`).
- **pnpm 12.10.1** (the `packageManager` field).
- **Docker** for the local MongoDB replica set. On macOS the project uses colima (`colima start`,
  not verified here).
- `openssl`, to generate `OTP_PEPPER`.

## First run

```sh
pnpm install
cp .env.example .env.local
# put a real pepper in .env.local:
#   OTP_PEPPER=<output of: openssl rand -hex 32>
pnpm db:up          # docker compose: mongo:8, replica set rs0 on localhost:27017 (not verified here)
pnpm db:indexes     # prints "<collection>: created …" or "up to date" per collection
pnpm seed           # first run: "categories: 8 inserted, 0 existing" / "products: 11 inserted, 0 existing"
pnpm dev            # http://localhost:3000
curl -s http://localhost:3000/api/health   # {"status":"ok","version":"0.1.0","db":"ok"}
```

- `pnpm dev` (Next.js) loads `.env.local` itself. `db:indexes` and `seed` run through
  `tsx --env-file-if-exists=.env.local`; a variable already set in the shell wins over the file,
  so `MONGODB_DB=aarvion_e2e pnpm seed` targets the e2e database.
- `next dev` would insert a `<!-- BEGIN:nextjs-agent-rules -->` block into `AGENTS.md` when it
  detects an AI agent. `agentRules: false` in `next.config.ts` (Next 16.4+) turns that off and
  removes an existing block on the next run; if a block shows up in a diff anyway, revert it.
- `pnpm db:up` waits for the container healthcheck, which also runs `rs.initiate` the first time.
  Data persists in the `mongo-data` Docker volume. `pnpm db:down` stops the container and keeps
  the volume.
- The seed is **insert-only**: re-running it never changes existing documents. To apply a data
  change to a database that already has it, prefer a targeted `updateOne` (the runbooks give
  each one, and README "Reseeding after the category rename" gives the category one).
- Starting a database over is **only for the local docker database** (or a fresh one) with no
  admin edits, orders or carts you want to keep, and **never for Preview or Production**. One
  guarded command checks the name and drops only a local dev database (`aarvion` by default, or
  `aarvion_e2e`); anything else is refused. Then seed again (not verified here):

  ```sh
  # the positional argument is the database to drop: your MONGODB_DB (default aarvion)
  docker compose exec mongo mongosh --quiet aarvion --eval '
    if (["aarvion", "aarvion_e2e"].includes(db.getName())) printjson(db.dropDatabase());
    else print("refusing: " + db.getName() + " is not a local dev database");'
  pnpm db:indexes && pnpm seed
  ```

## Environment variables

`src/server/env.ts` is the only reader of `process.env`. It parses lazily with zod, treats an
empty string as unset, and throws `EnvError` naming the bad key on first use, never at import.
To add a variable: extend the schema in `env.ts`, add the name (no real value) to `.env.example`,
add a row below, and a line to the CHANGELOG.

| Name | Purpose | Required where | Example |
| --- | --- | --- | --- |
| `MONGODB_URI` | Mongo connection string | dev (for DB routes), e2e (defaults to the local replica set), Preview, Production; int tests set it themselves | `mongodb://localhost:27017/?replicaSet=rs0&directConnection=true` |
| `MONGODB_DB` | Database name; default `aarvion` | optional locally; e2e forces `aarvion_e2e`; **Production must be `aarvion_prod`**; Preview uses its own name | `aarvion` |
| `OTP_PEPPER` | HMAC secret mixed into stored OTP hashes; at least 32 characters | wherever OTP send or verify runs (dev, Preview, Production); the e2e build generates one per run | `openssl rand -hex 32` |
| `APP_URL` | Public base URL; its origin is accepted by `assertSameOrigin` | optional; set it in deployed scopes (it is also the `metadataBase` for Open Graph and icon URLs) | `https://aarvion.example` |
| `VERCEL_ENV` | `production`, `preview` or `development` | set by Vercel only; `production` forbids mocks | empty locally |
| `ALLOW_MOCKS_IN_PROD_BUILD` | `1` lets a production build (`pnpm build && pnpm start`) use mocks | the e2e build and the Vercel Preview scope only; **never Production** | `1` |
| `SMS_PROVIDER` | `mock` or `msg91`; default `mock` | `msg91` is not implemented yet (N phase) and throws | `mock` |
| `EMAIL_PROVIDER` | `mock` or `resend`; default `mock` | `resend` is not implemented yet (N phase) and throws | `mock` |
| `PAYMENTS_PROVIDER` | `fake` or `razorpay`; default `fake` | `razorpay` is not implemented yet (O phase) and throws | `fake` |
| `FILE_STORE` | `memory`, `local` or `blob`; default `memory` | `memory` for tests and e2e; `local` for `pnpm dev` when uploads should survive a restart; `blob` on every Vercel scope (memory and local are refused whenever `VERCEL_ENV` is set, and in production) | `memory` |
| `FILE_STORE_LOCAL_DIR` | Folder for `FILE_STORE=local`; default `.data/files` (gitignored) | `pnpm dev` with `FILE_STORE=local` | `.data/files` |
| `BLOB_READ_WRITE_TOKEN` | Read-write token of the private Vercel Blob store | `FILE_STORE=blob` (Preview, Production); Vercel sets it when a Blob store is connected to the project; checked by `pnpm vercel-build` and on the first file access | never commit it |
| `NODE_ENV` | Set by Next.js and Vitest | never set it by hand | |
| `SEED_DATA_DIR` | `pnpm seed` reads its JSON from this directory instead of `data/` | tests only | |
| `MONGOMS_DOWNLOAD_DIR` | Where mongodb-memory-server caches the mongod binary | the CI `int` job | `${{ runner.temp }}/mongodb-binaries` |
| `CI` | Playwright: forbid `.only`, one retry, GitHub reporter, no server reuse | the CI `e2e` job | `true` |

`.env.example` holds names and safe local defaults only. Never commit `.env.local` (`.env.*` is
gitignored).

## Dev pages (`/dev/*`)

`/dev/outbox` and `/dev/styleguide` (every base component on one screen; open it after changing
a component or `src/styles/*.css`) exist only where mocks are allowed. The styleguide's foil
pockets read the catalogue, so run `pnpm db:up && pnpm db:indexes && pnpm seed` first; without a
database that section shows a hint (and the server log the error name) and the rest still renders. Where `isMockForbidden()`
is true (production, or the production database) `src/proxy.ts` answers a real HTTP 404 for
every `/dev/*` request before anything renders; `requireDevRoute()` in each page or route is the
second guard. A new dev page needs both (the proxy already matches `/dev/:path*`) and
`export const instant = false` if it calls `connection()` first. `src/proxy.test.ts` covers the 404 (the e2e harness allows mocks, so a mocks-forbidden production
check is manual: `pnpm build && pnpm start`, then curl `/dev/styleguide` without the flag). Any component
that attaches an event handler must be a `"use client"` module; keep pure helpers out of it.

## The dev outbox (reading OTPs locally)

With the mock providers, an OTP is not sent anywhere: `mockSms` and `mockEmail` write it to the
`dev_outbox` collection (kept 24 h by a TTL index). Read it with the JSON route
`GET /dev/outbox?to=<identifier>`.

```sh
# send a code (mutations need a matching Origin and a JSON body)
curl -s -X POST http://localhost:3000/api/auth/otp/send \
  -H 'content-type: application/json' -H 'origin: http://localhost:3000' \
  -d '{"channel":"email","identifier":"you@example.test"}'
# read it
curl -s 'http://localhost:3000/dev/outbox?to=you@example.test'
```

- To sign in through the UI, open `/login`, ask for a code, then read it here (the page itself never
  shows the outbox; its demo states, Task 42, appear only where `isMockForbidden()` is false).
- `to` is the **normalised** identifier: an email trimmed and lowercased, or a phone as
  `+91XXXXXXXXXX` (URL-encode the plus: `to=%2B91XXXXXXXXXX`). SMS messages carry the code in
  `payload.vars.code`; emails in `payload.text`.
- `/dev/*` answers 404 whenever `isMockForbidden()` holds: on Vercel Production, on a production
  build without `ALLOW_MOCKS_IN_PROD_BUILD=1`, or when the database is `aarvion_prod`. Under
  `pnpm dev` it works.
- Verify with `POST /api/auth/otp/verify` and `{"channel","identifier","code"}`. A first login
  also needs `"signup": {"name","adult":true,"termsPrivacy":true,"marketing"}`, stored as the
  new user's consent; without it the right code answers 409 `signup_required` and stays usable
  until its original expiry (a resend replaces it). The session
  cookie `__Host-aarv_sid` needs `Secure`: it works on `http://localhost` in Chrome and Firefox,
  but not in Safari, on LAN addresses or on `*.test` hosts. Use `localhost` or https.

## Common problems

| Symptom | Cause and fix |
| --- | --- |
| `/api/health` says `"db":"skipped"` | `MONGODB_URI` is unset (allowed outside production). Set it in `.env.local`. |
| `/api/health` 503 `"db":"down"` | Mongo is not reachable within 3.5 s. Run `pnpm db:up`; check port 27017. |
| 500 `server_misconfigured` | An env var is missing or invalid, usually `OTP_PEPPER`. The server log names the key. |
| 403 `bad_origin` | A POST without an `Origin` header, or with a different origin. |
| 415 `unsupported_media_type` | The body is not sent as `application/json`. |
| 429 `resend_cooldown` | A new code was asked for within 30 s. |
| 429 `rate_limited` | Send limit (20/h per IP, 3/10 min per identifier), verify limit (60/h per IP) or search limit (`GET /api/products`, 60/min per IP). Locally every request without `x-real-ip` shares the `unknown` IP bucket, search included. |
| `scripts/vitest-projects.test.ts` fails | A test file matches no Vitest project, or two. See [testing.md](testing.md). |
| Int tests fail with "port already in use" | Two int runs at once share the port blocks and retry; run one at a time. |
