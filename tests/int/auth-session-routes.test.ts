import { ObjectId } from "mongodb";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { GET as ME } from "@/app/api/auth/me/route";
import { POST as LOGOUT } from "@/app/api/auth/logout/route";
import { POST as SEND } from "@/app/api/auth/otp/send/route";
import { POST as VERIFY } from "@/app/api/auth/otp/verify/route";
import { getAuth, requireRole, requireUser } from "@/server/auth/guards";
import { OTP_COLLECTION } from "@/server/auth/otp";
import { SESSIONS_COLLECTION, createSession, resolveSession } from "@/server/auth/sessions";
import { USERS_COLLECTION, type UserDoc } from "@/server/auth/users";
import { getDb } from "@/server/db/client";
import { resetDepsForTests } from "@/server/deps";
import "@/server/db/register-all.ts";
import { resetEnvForTests } from "@/server/env";
import { OUTBOX_COLLECTION } from "@/server/providers/outbox";
import { RATE_LIMITS_COLLECTION } from "@/server/security/rate-limit";
import { installClock } from "../helpers/clock";
import { getReq, jsonPost, sessionTokenFrom } from "../helpers/http";
import { clearCollections, startMemoryReplSet, stopMemoryReplSet } from "../helpers/mongo";
import { lastOtpCode } from "../helpers/otp";

const PHONE = "+919876543210";
const AUDIT = "audit_logs";
let clock: ReturnType<typeof installClock>;

beforeAll(async () => {
  vi.stubEnv("OTP_PEPPER", "x".repeat(64));
  resetEnvForTests();
  await startMemoryReplSet();
}, 120_000);
afterAll(async () => {
  resetDepsForTests();
  await stopMemoryReplSet();
  vi.unstubAllEnvs();
  resetEnvForTests();
});
beforeEach(async () => {
  vi.stubEnv("OTP_PEPPER", "x".repeat(64));
  resetEnvForTests();
  resetDepsForTests();
  clock = installClock("2026-11-17T04:30:00Z");
  await clearCollections(
    OTP_COLLECTION,
    RATE_LIMITS_COLLECTION,
    OUTBOX_COLLECTION,
    USERS_COLLECTION,
    SESSIONS_COLLECTION,
    AUDIT,
  );
});

const cookie = (token: string) => `__Host-aarv_sid=${token}`;
const me = (token?: string) => ME(getReq("/api/auth/me", token ? { cookie: cookie(token) } : {}));
const MIN = 60_000;

async function loginCustomer(): Promise<string> {
  await SEND(jsonPost("/api/auth/otp/send", { channel: "phone", identifier: PHONE }));
  const code = await lastOtpCode(PHONE);
  const res = await VERIFY(
    jsonPost("/api/auth/otp/verify", { channel: "phone", identifier: PHONE, code }),
  );
  expect(res.status).toBe(200);
  return sessionTokenFrom(res)!;
}

async function insertUser(role: UserDoc["role"], phone = "+919800000001"): Promise<UserDoc> {
  const user: UserDoc = {
    _id: new ObjectId(),
    phone,
    role,
    createdAt: clock.now(),
    updatedAt: clock.now(),
    lastLoginAt: clock.now(),
  };
  await (await getDb()).collection<UserDoc>(USERS_COLLECTION).insertOne(user);
  return user;
}

describe("GET /api/auth/me", () => {
  it("401s without a cookie, uncached", async () => {
    const res = await me();
    expect(res.status).toBe(401);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toEqual({ error: "unauthenticated" });
  });

  it("returns the public user", async () => {
    const token = await loginCustomer();
    const res = await me(token);
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toEqual({
      user: {
        id: expect.stringMatching(/^[0-9a-f]{24}$/),
        phone: PHONE,
        email: null,
        role: "customer",
        name: null,
      },
    });
  });

  it("re-issues the customer cookie only when the session slides", async () => {
    const token = await loginCustomer();
    clock.advance(30_000);
    expect((await me(token)).headers.get("set-cookie")).toBeNull();
    clock.advance(2 * MIN);
    const slid = await me(token);
    expect(slid.status).toBe(200);
    expect(slid.headers.get("set-cookie")).toBe(
      `__Host-aarv_sid=${token}; Path=/; Max-Age=2592000; Secure; HttpOnly; SameSite=Lax`,
    );
  });

  it("staff sessions slide for 30 min idle, then expire; no Max-Age cookie", async () => {
    const user = await insertUser("pharmacist");
    const { token } = await createSession(user, clock.now());
    clock.advance(29 * MIN);
    const ok = await me(token);
    expect(ok.status).toBe(200);
    expect(ok.headers.get("set-cookie")).toBeNull();
    clock.advance(31 * MIN);
    expect((await me(token)).status).toBe(401);
  });

  it("401s when the user no longer exists", async () => {
    const token = await loginCustomer();
    await (await getDb()).collection(USERS_COLLECTION).deleteMany({});
    expect((await me(token)).status).toBe(401);
  });
});

describe("POST /api/auth/logout", () => {
  const logout = (token: string | undefined, origin: string | null = "http://localhost:3000") =>
    LOGOUT(
      jsonPost("/api/auth/logout", {}, { origin, ...(token ? { cookie: cookie(token) } : {}) }),
    );

  it("rejects a request without Origin and leaves the session", async () => {
    const token = await loginCustomer();
    const res = await logout(token, null);
    expect(res.status).toBe(403);
    expect((await me(token)).status).toBe(200);
  });

  it("revokes, clears the cookie, audits, and is idempotent", async () => {
    const token = await loginCustomer();
    const res = await logout(token);
    expect(res.status).toBe(204);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(res.headers.get("set-cookie")).toContain("Max-Age=0");
    expect((await me(token)).status).toBe(401);
    expect((await logout(token)).status).toBe(204);
    expect((await logout(undefined)).status).toBe(204);
    const entries = await (
      await getDb()
    )
      .collection(AUDIT)
      .find({ action: "auth.logout" })
      .toArray();
    expect(entries).toHaveLength(1);
    const user = await (await getDb()).collection<UserDoc>(USERS_COLLECTION).findOne({});
    expect(entries[0]).toMatchObject({
      actor: { type: "user", userId: user!._id, role: "customer" },
      at: clock.now(),
    });
  });

  it("revokes the session before it writes the audit row, and even when that write fails", async () => {
    const token = await loginCustomer();
    let sessionsAtAudit = -1;
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { Collection } = await import("mongodb");
    const real = Collection.prototype.insertOne;
    const spy = vi.spyOn(Collection.prototype, "insertOne").mockImplementation(async function (
      this: InstanceType<typeof Collection>,
      ...args: Parameters<typeof real>
    ) {
      if (this.collectionName === AUDIT) {
        sessionsAtAudit = await (await getDb()).collection(SESSIONS_COLLECTION).countDocuments();
        throw new Error("audit down");
      }
      return real.apply(this, args);
    } as typeof real);
    try {
      expect((await logout(token)).status).toBe(204);
    } finally {
      spy.mockRestore();
      errorSpy.mockRestore();
    }
    expect(sessionsAtAudit).toBe(0);
    expect((await me(token)).status).toBe(401);
  });
});

describe("guards", () => {
  const req = (token: string) => getReq("/x", { cookie: cookie(token) });

  it("requireUser throws 401 without a session", async () => {
    await expect(requireUser(getReq("/x"))).rejects.toMatchObject({
      status: 401,
      code: "unauthenticated",
    });
  });

  it("requireRole passes a pharmacist staff session and 403s operations", async () => {
    const pharm = await insertUser("pharmacist", "+919800000001");
    const ops = await insertUser("operations", "+919800000002");
    const a = await createSession(pharm, clock.now());
    const b = await createSession(ops, clock.now());
    const ctx = await requireRole(req(a.token), ["pharmacist", "admin"]);
    expect(ctx.user.role).toBe("pharmacist");
    await expect(requireRole(req(b.token), ["pharmacist", "admin"])).rejects.toMatchObject({
      status: 403,
      code: "forbidden",
    });
    await expect(requireRole(getReq("/x"), ["admin"])).rejects.toMatchObject({ status: 401 });
  });

  it("stale privilege: a customer session of a user promoted to admin is 403 until re-login", async () => {
    const user = await insertUser("customer");
    const old = await createSession(user, clock.now());
    // Raw update: setUserRole would revoke the session and give 401, not the 403 under test.
    await (
      await getDb()
    )
      .collection<UserDoc>(USERS_COLLECTION)
      .updateOne({ _id: user._id }, { $set: { role: "admin" } });
    await expect(requireRole(req(old.token), ["admin"])).rejects.toMatchObject({ status: 403 });
    const fresh = await createSession({ _id: user._id, role: "admin" }, clock.now());
    expect((await requireRole(req(fresh.token), ["admin"])).user.role).toBe("admin");
  });

  it("a staff session whose user was demoted is 403 (role read fresh)", async () => {
    const user = await insertUser("admin");
    const s = await createSession(user, clock.now());
    await (
      await getDb()
    )
      .collection<UserDoc>(USERS_COLLECTION)
      .updateOne({ _id: user._id }, { $set: { role: "customer" } });
    await expect(requireRole(req(s.token), ["admin"])).rejects.toMatchObject({ status: 403 });
  });

  it("concurrent resolveSession calls both succeed and exactly one slides the session", async () => {
    const user = await insertUser("customer");
    const { token } = await createSession(user, clock.now());
    clock.advance(5 * MIN); // due for a touch
    const results = await Promise.all(
      Array.from({ length: 4 }, () => resolveSession(token, clock.now())),
    );
    expect(results.every((r) => r !== null)).toBe(true);
    expect(results.filter((r) => r!.refreshed)).toHaveLength(1);
    expect(results[0]!.session.userId).toEqual(user._id);
  });

  it("a session revoked between read and touch is never valid", async () => {
    const user = await insertUser("customer");
    const { token } = await createSession(user, clock.now());
    clock.advance(5 * MIN); // due for a touch
    const { Collection } = await import("mongodb");
    const real = Collection.prototype.updateOne;
    const spy = vi.spyOn(Collection.prototype, "updateOne").mockImplementation(async function (
      this: InstanceType<typeof Collection>,
      ...args: Parameters<typeof real>
    ) {
      if (this.collectionName === SESSIONS_COLLECTION) await this.deleteMany({});
      return real.apply(this, args);
    } as typeof real);
    try {
      expect(await resolveSession(token, clock.now())).toBeNull();
    } finally {
      spy.mockRestore();
    }
    expect(await getAuth(getReq("/x", { cookie: cookie(token) }), clock.now())).toBeNull();
  });
});
