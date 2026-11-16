import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { getDb } from "@/server/db/client";
import { ensureIndexes } from "@/server/db/indexes";
import "@/server/db/register-all";
import {
  RATE_LIMITS_COLLECTION,
  hitRateLimit,
  peekRateLimit,
  resetRateLimit,
} from "@/server/security/rate-limit";
import { startMemoryReplSet, stopMemoryReplSet } from "../helpers/mongo";

beforeAll(async () => {
  await startMemoryReplSet();
}, 120_000);
afterAll(stopMemoryReplSet);

beforeEach(async () => {
  const db = await getDb();
  await db.collection(RATE_LIMITS_COLLECTION).deleteMany({});
});

const T = new Date("2026-11-17T04:30:00Z");
const windowMs = 600_000;
const at = (ms: number) => new Date(T.getTime() + ms);

describe("hitRateLimit", () => {
  it("allows up to the limit then blocks with retryAfterSec", async () => {
    const base = { key: "a", limit: 3, windowMs, now: T };
    for (const n of [1, 2, 3]) {
      const r = await hitRateLimit(base);
      expect(r).toMatchObject({ allowed: true, count: n, retryAfterSec: 0 });
    }
    const r = await hitRateLimit(base);
    expect(r).toMatchObject({ allowed: false, count: 4, limit: 3, retryAfterSec: 600 });
    expect(r.resetAt).toEqual(at(windowMs));
  });

  it("resets at the window boundary even while the old document still exists", async () => {
    const base = { key: "b", limit: 3, windowMs };
    await hitRateLimit({ ...base, now: T });
    const inside = await hitRateLimit({ ...base, now: at(599_999) });
    expect(inside.count).toBe(2);
    const db = await getDb();
    expect(
      await db.collection(RATE_LIMITS_COLLECTION).findOne({ _id: "b" as never }),
    ).not.toBeNull();
    const after = await hitRateLimit({ ...base, now: at(windowMs) });
    expect(after).toMatchObject({ count: 1, allowed: true });
    expect(after.resetAt).toEqual(at(windowMs + windowMs));
  });

  it("allows exactly the limit under 20 concurrent hits with limit 5", async () => {
    const results = await Promise.all(
      Array.from({ length: 20 }, () => hitRateLimit({ key: "c", limit: 5, windowMs, now: T })),
    );
    expect(results.filter((r) => r.allowed)).toHaveLength(5);
  });

  it("allows exactly 20 of 50 concurrent hits and counts all 50", async () => {
    const results = await Promise.all(
      Array.from({ length: 50 }, () => hitRateLimit({ key: "d", limit: 20, windowMs, now: T })),
    );
    expect(results.filter((r) => r.allowed)).toHaveLength(20);
    const db = await getDb();
    const doc = await db.collection(RATE_LIMITS_COLLECTION).findOne({ _id: "d" as never });
    expect(doc?.count).toBe(50);
  });

  it("keeps keys independent", async () => {
    await hitRateLimit({ key: "k1", limit: 1, windowMs, now: T });
    await hitRateLimit({ key: "k1", limit: 1, windowMs, now: T });
    const other = await hitRateLimit({ key: "k2", limit: 1, windowMs, now: T });
    expect(other).toMatchObject({ allowed: true, count: 1 });
  });
});

describe("peekRateLimit", () => {
  it("never writes and reports 0 for a new key", async () => {
    const r = await peekRateLimit({ key: "p", limit: 2, windowMs, now: T });
    expect(r).toMatchObject({ count: 0, allowed: true, retryAfterSec: 0 });
    const db = await getDb();
    expect(await db.collection(RATE_LIMITS_COLLECTION).countDocuments()).toBe(0);
  });

  it("blocks once count reaches the limit, and treats an expired window as empty", async () => {
    const i = { key: "q", limit: 2, windowMs, now: T };
    await hitRateLimit(i);
    await hitRateLimit(i);
    expect(await peekRateLimit(i)).toMatchObject({ count: 2, allowed: false, retryAfterSec: 600 });
    expect(await peekRateLimit({ ...i, now: at(windowMs) })).toMatchObject({
      count: 0,
      allowed: true,
    });
  });
});

describe("resetRateLimit", () => {
  it("drops the window so the next hit starts again at 1, and leaves other keys alone", async () => {
    const i = { key: "r", limit: 2, windowMs, now: T };
    for (let n = 0; n < 3; n++) await hitRateLimit(i);
    await hitRateLimit({ ...i, key: "r2" });
    expect((await peekRateLimit(i)).allowed).toBe(false);
    await resetRateLimit("r");
    expect(await peekRateLimit(i)).toMatchObject({ count: 0, allowed: true });
    expect(await hitRateLimit(i)).toMatchObject({ count: 1, allowed: true });
    expect(await peekRateLimit({ ...i, key: "r2" })).toMatchObject({ count: 1 });
  });

  it("is a no-op for a key with no window", async () => {
    await expect(resetRateLimit("never-hit")).resolves.toBeUndefined();
    const db = await getDb();
    expect(await db.collection(RATE_LIMITS_COLLECTION).countDocuments()).toBe(0);
  });
});

describe("indexes", () => {
  it("creates the expiresAt TTL index", async () => {
    const db = await getDb();
    await ensureIndexes(db);
    const idx = await db.collection(RATE_LIMITS_COLLECTION).indexes();
    expect(idx).toContainEqual(
      expect.objectContaining({
        name: "expiresAt_ttl",
        expireAfterSeconds: 0,
        key: { expiresAt: 1 },
      }),
    );
  });
});
