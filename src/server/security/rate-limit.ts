import { getDb } from "../db/client.ts";
import { registerIndexes } from "../db/indexes.ts";

export const RATE_LIMITS_COLLECTION = "rate_limits";

registerIndexes(RATE_LIMITS_COLLECTION, [
  { key: { expiresAt: 1 }, name: "expiresAt_ttl", expireAfterSeconds: 0 },
]);

export type RateLimitInput = { key: string; limit: number; windowMs: number; now: Date };
export type RateLimitResult = {
  allowed: boolean;
  count: number;
  limit: number;
  resetAt: Date;
  retryAfterSec: number;
};

type RateDoc = { _id: string; count: number; expiresAt: Date };

function retryAfter(resetAt: Date, now: Date): number {
  return Math.max(0, Math.ceil((resetAt.getTime() - now.getTime()) / 1000));
}

/**
 * Fixed window starting at the first hit. The window reset happens atomically in
 * one pipeline upsert and checks `expiresAt` at query time, because the TTL
 * monitor runs only about every 60 s and may leave an expired document behind.
 */
export async function hitRateLimit(i: RateLimitInput): Promise<RateLimitResult> {
  const col = (await getDb()).collection<RateDoc>(RATE_LIMITS_COLLECTION);
  const expired = {
    $or: [{ $eq: [{ $type: "$expiresAt" }, "missing"] }, { $lte: ["$expiresAt", i.now] }],
  };
  const run = () =>
    col.findOneAndUpdate(
      { _id: i.key },
      [
        {
          $set: {
            count: { $cond: [expired, 1, { $add: ["$count", 1] }] },
            expiresAt: {
              $cond: [expired, new Date(i.now.getTime() + i.windowMs), "$expiresAt"],
            },
          },
        },
      ],
      { upsert: true, returnDocument: "after" },
    );
  let doc;
  try {
    doc = await run();
  } catch (err) {
    // Two first hits racing the insert: the loser retries as an update.
    if ((err as { code?: number }).code !== 11000) throw err;
    doc = await run();
  }
  if (!doc) throw new Error("rate limit upsert returned no document");
  const allowed = doc.count <= i.limit;
  return {
    allowed,
    count: doc.count,
    limit: i.limit,
    resetAt: doc.expiresAt,
    retryAfterSec: allowed ? 0 : retryAfter(doc.expiresAt, i.now),
  };
}

/** Drops the key's window, so the next hit starts a fresh one at 1. A missing key is a no-op. */
export async function resetRateLimit(key: string): Promise<void> {
  await (await getDb()).collection<RateDoc>(RATE_LIMITS_COLLECTION).deleteOne({ _id: key });
}

/** Read-only: never writes. A missing or expired window counts as 0. */
export async function peekRateLimit(i: RateLimitInput): Promise<RateLimitResult> {
  const col = (await getDb()).collection<RateDoc>(RATE_LIMITS_COLLECTION);
  const doc = await col.findOne({ _id: i.key });
  const live = doc && doc.expiresAt.getTime() > i.now.getTime() ? doc : null;
  const count = live?.count ?? 0;
  const resetAt = live?.expiresAt ?? new Date(i.now.getTime() + i.windowMs);
  const allowed = count < i.limit;
  return {
    allowed,
    count,
    limit: i.limit,
    resetAt,
    retryAfterSec: allowed ? 0 : retryAfter(resetAt, i.now),
  };
}
