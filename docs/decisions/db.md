# Database decisions

## Indexes

- Indexes are registered in code (`registerIndexes`) and applied by `pnpm db:indexes`
  (`ensureIndexes`), which only creates indexes that are missing by name.
- **Rename, never change in place.** `ensureIndexes` matches on index name, so
  changing an index's keys or options under the same name reports "up to date" and
  changes nothing. To change an index, give it a new name and drop the old one in a
  later release. Unique constraints and TTLs must never silently fail to land.
- **Drift detection** (compare live index options against the registry and fail on a
  mismatch) lands in phase H, before the H5 production deploy.
- TTL expiry is not a security boundary: MongoDB deletes expired documents about
  every 60 seconds, so OTP, session and rate-limit expiry must also be checked in code.
