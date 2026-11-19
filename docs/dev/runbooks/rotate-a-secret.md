# Runbook: rotate a secret (planned)

**Planned.** Nothing is deployed yet, so no secret has been rotated, and none of the steps below
has been run. Where Vercel or Atlas steps appear they are **not verified here**; check the
provider's current docs when you first do it, then update this page.

## Secrets in use

| Secret | Where | Effect of rotating |
| --- | --- | --- |
| `OTP_PEPPER` | Vercel env, per scope; `.env.local` locally | every live OTP (at most 5 minutes old) stops matching |
| `MONGODB_URI` credentials | Vercel env, per scope | connections with the old password fail |
| MSG91, Resend, Razorpay and Vercel Blob keys | Vercel env (names defined when the N, O and R phases build the providers) | depends on the provider |

Sessions have no secret: only the SHA-256 of each random token is stored, so no key rotation
logs anyone out. To log everyone out of one scope, run `db.sessions.deleteMany({})` in mongosh
against that scope's database (`MONGODB_DB`, e.g. `aarvion_prod`). It logs out staff as well as
customers; they sign in again with a new OTP.

## Rotate `OTP_PEPPER`

Why it matters: a stored OTP hash is HMAC-SHA256(pepper, challenge id, identifier, code). After a
rotation, a code issued under the old pepper fails as a **mismatch**, and mismatches count toward
the 10-per-24 h lockout. Clear the live challenges so users simply ask for a new code.

1. Generate: `openssl rand -hex 32`. Never paste it into a file in the repo, a PR or a log.
2. Set it in the Vercel project for the one scope you are rotating (not verified here).
3. Redeploy that scope so new functions read it (not verified here).
4. Right after the deploy is live, clear the open challenges in that scope's database:
   `db.otp_challenges.deleteMany({})` in mongosh. A verify then finds no challenge, which returns
   `invalid_code` without counting toward the lockout.
5. Check: send and verify a login on that scope (Preview: read the code from `/dev/outbox`).
6. CHANGELOG: nothing (no code change). Note the date and scope in your operations log; never
   the value.

## Rotate the database password (no outage)

Changing a database user's password invalidates the old one at once, which would break every
running deployment (and, after UI Task 7, every build) until a redeploy. Rotate by user instead:

1. In Atlas, create a **second** database user with the same roles (not verified here).
2. Update `MONGODB_URI` in that one Vercel scope to the new user, and redeploy.
3. Check `GET /api/health` shows `db: "ok"` on the new deployment, and that its build (which
   prerenders from the DB once UI Task 7 lands) succeeded.
4. Only then delete the old user in Atlas.
5. Repeat per scope. CHANGELOG: nothing; note the date and scope in your operations log.

## If a secret leaked

Treat it as compromised: rotate it first, then look for use. A leaked `OTP_PEPPER` alone does not
reveal codes without the database. If a secret was committed, rotating is the fix: never rewrite
pushed history to hide it; ask the owner.
