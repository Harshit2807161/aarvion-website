import { ObjectId } from "mongodb";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  SESSIONS_COLLECTION,
  SESSION_POLICY,
  createSession,
  hashSessionToken,
  resolveSession,
  revokeSession,
  sessionKindForRole,
} from "@/server/auth/sessions";
import { getDb } from "@/server/db/client";
import { ensureIndexes } from "@/server/db/indexes";
import "@/server/db/register-all.ts";
import { clearCollections, startMemoryReplSet, stopMemoryReplSet } from "../helpers/mongo";

beforeAll(async () => {
  await startMemoryReplSet();
  await ensureIndexes(await getDb());
}, 120_000);
afterAll(stopMemoryReplSet);
beforeEach(async () => {
  await clearCollections(SESSIONS_COLLECTION);
});

const T = new Date("2026-11-17T04:30:00Z");
const at = (ms: number) => new Date(T.getTime() + ms);
const SEC = 1000;
const MIN = 60_000;
const DAY = 86_400_000;
const customer = () => ({ _id: new ObjectId(), role: "customer" as const });
const staff = () => ({ _id: new ObjectId(), role: "pharmacist" as const });

async function stored(token: string) {
  const db = await getDb();
  return db.collection(SESSIONS_COLLECTION).findOne({ _id: hashSessionToken(token) as never });
}

describe("createSession", () => {
  it("stores only the sha256 of a 43-char token", async () => {
    const { token, session } = await createSession(customer(), T);
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(session._id).toBe(hashSessionToken(token));
    const doc = await stored(token);
    expect(doc).not.toBeNull();
    expect(Object.values(doc!)).not.toContain(token);
    expect(JSON.stringify(doc)).not.toContain(token);
  });

  it("applies the policy per kind", async () => {
    const c = (await createSession(customer(), T)).session;
    expect(c).toMatchObject({ kind: "customer", absoluteExpiresAt: null });
    expect(c.idleExpiresAt).toEqual(at(SESSION_POLICY.customer.idleMs));
    expect(c.expiresAt).toEqual(c.idleExpiresAt);
    const s = (await createSession(staff(), T)).session;
    expect(s.kind).toBe("staff");
    expect(s.idleExpiresAt).toEqual(at(30 * MIN));
    expect(s.absoluteExpiresAt).toEqual(at(720 * MIN));
    expect(s.expiresAt).toEqual(at(30 * MIN));
  });
});

it("maps roles to session kinds", () => {
  expect(sessionKindForRole("customer")).toBe("customer");
  for (const r of ["pharmacist", "operations", "admin"] as const) {
    expect(sessionKindForRole(r)).toBe("staff");
  }
});

it("fails closed: only explicit staff roles map to staff, anything else to customer", () => {
  for (const r of ["", "superuser", "Admin", undefined, null]) {
    expect(sessionKindForRole(r as never)).toBe("customer");
  }
});

describe("touch throttle", () => {
  it("touches at most once a minute", async () => {
    const { token } = await createSession(customer(), T);
    const early = await resolveSession(token, at(30 * SEC));
    expect(early?.refreshed).toBe(false);
    expect((await stored(token))!.lastSeenAt).toEqual(T);
    const due = await resolveSession(token, at(60 * SEC));
    expect(due?.refreshed).toBe(true);
    const doc = (await stored(token))!;
    expect(doc.lastSeenAt).toEqual(at(60 * SEC));
    expect(doc.idleExpiresAt).toEqual(at(60 * SEC + SESSION_POLICY.customer.idleMs));
  });
});

describe("customer sliding session", () => {
  it("slides while used", async () => {
    const { token } = await createSession(customer(), T);
    expect(await resolveSession(token, at(29 * DAY))).not.toBeNull();
    expect(await resolveSession(token, at(58 * DAY))).not.toBeNull();
  });

  it("expires at exactly 30 days untouched and deletes the document", async () => {
    const { token } = await createSession(customer(), T);
    expect(await stored(token)).not.toBeNull();
    expect(await resolveSession(token, at(30 * DAY))).toBeNull();
    expect(await stored(token)).toBeNull();
  });

  it("is still valid 1 ms before 30 days", async () => {
    const { token } = await createSession(customer(), T);
    expect(await resolveSession(token, at(30 * DAY - 1))).not.toBeNull();
  });
});

describe("staff session", () => {
  it("idle: slides at 29 and 58 min, dies at exactly 88 min", async () => {
    const { token } = await createSession(staff(), T);
    expect(await resolveSession(token, at(29 * MIN))).not.toBeNull();
    expect(await resolveSession(token, at(58 * MIN))).not.toBeNull();
    expect(await resolveSession(token, at(88 * MIN))).toBeNull();
    expect(await stored(token)).toBeNull();
  });

  it("absolute: survives every 25 min up to 700 min, dies at exactly 720 min", async () => {
    const { token } = await createSession(staff(), T);
    for (let m = 25; m <= 700; m += 25) {
      expect(await resolveSession(token, at(m * MIN)), `at ${m} min`).not.toBeNull();
    }
    expect(await resolveSession(token, at(720 * MIN))).toBeNull();
    expect(await stored(token)).toBeNull();
  });

  it("keeps expiresAt at the absolute cap once the idle window would pass it", async () => {
    const { token } = await createSession(staff(), T);
    for (let m = 25; m <= 700; m += 25) await resolveSession(token, at(m * MIN));
    expect((await stored(token))!.expiresAt).toEqual(at(720 * MIN));
  });
});

describe("revokeSession", () => {
  it("makes the token unresolvable", async () => {
    const { token } = await createSession(customer(), T);
    await revokeSession(token);
    expect(await resolveSession(token, T)).toBeNull();
  });
  it("ignores unknown tokens", async () => {
    await expect(revokeSession("nope")).resolves.toBeUndefined();
    expect(await resolveSession("garbage", T)).toBeNull();
  });
});
