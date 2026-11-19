# Runbook: handle a failed deploy (planned)

**Planned.** There is no deployment yet, so this runbook has never been exercised. Vercel steps
are **not verified here**; refine this page after the first real incident.

## 1. Find which kind of failure

| Signal | Likely cause | Fix |
| --- | --- | --- |
| The Vercel build fails at `next build` | the same failure as the CI `build` job | reproduce with `pnpm build` locally; fix in a PR |
| Build fails with `CatalogueEmptyError` (after UI plan Task 7) | the build-time database for that scope is empty or unreachable | seed it (`pnpm db:indexes && pnpm seed` with that scope's env); check Atlas network access for Vercel builds |
| `/api/health` 503 `"db":"misconfigured"` | an env var is invalid; the function log names the key (never the value) | fix the variable in that Vercel scope, redeploy |
| `/api/health` 503 `"db":"unconfigured"` | `MONGODB_URI` missing in a production-like runtime | set it in that scope |
| `/api/health` 503 `"db":"down"` | the database did not answer within 3.5 s | Atlas status, network access, credentials |
| 500 with "Mock providers are not allowed in production" in the log | a provider variable is still `mock`, `fake` or `memory` in Production, or the scope points at `aarvion_prod` | set real providers; never set `ALLOW_MOCKS_IN_PROD_BUILD` in Production |
| 500 with "…: not implemented yet" | a real provider was selected before its phase built it | keep that feature off until the provider exists |
| `/dev/*` answers 404 on a preview | the preview is production-like: `ALLOW_MOCKS_IN_PROD_BUILD` missing in the Preview scope, or its DB is `aarvion_prod` | fix the Preview scope; never point a preview at `aarvion_prod` |

Routes log error names only, so a log line says `EnvError` or `MongoServerSelectionError`, not
details. That is deliberate.

## 2. Restore service

- Roll back to the last good deployment in Vercel (not verified here). This needs no code change.
- Then fix forward on a `fix/` branch through the normal gate. To undo a merged PR, open a revert
  PR (`git revert <squash sha>` on a new branch). **Never force-push or reset `main`.**
- Indexes are never changed in place: a changed index gets a new name, and the old one is
  dropped only in a later release ([docs/decisions/db.md](../../decisions/db.md)).

## 3. Record it

- CHANGELOG → Fixed: `- <what broke and the fix> (#<pr>).`
- If a rule or setting changed, add a ruling to `docs/decisions/rulings.md`.
- Update this runbook with what actually happened.
