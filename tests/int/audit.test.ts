import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { POST as SEND } from "@/app/api/auth/otp/send/route";
import { POST as VERIFY } from "@/app/api/auth/otp/verify/route";
import { OTP_COLLECTION } from "@/server/auth/otp";
import { SESSIONS_COLLECTION } from "@/server/auth/sessions";
import { USERS_COLLECTION } from "@/server/auth/users";
import { appendAudit } from "@/server/audit";
import { getDb } from "@/server/db/client";
import { resetDepsForTests } from "@/server/deps";
import "@/server/db/register-all.ts";
import { ensureIndexes } from "@/server/db/indexes";
import { resetEnvForTests } from "@/server/env";
import { OUTBOX_COLLECTION } from "@/server/providers/outbox";
import { RATE_LIMITS_COLLECTION } from "@/server/security/rate-limit";
import { DEFAULT_SIGNUP } from "../helpers/auth";
import { installClock } from "../helpers/clock";
import { jsonPost } from "../helpers/http";
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

async function login(): Promise<Response> {
  await SEND(jsonPost("/api/auth/otp/send", { channel: "phone", identifier: PHONE }));
  const code = await lastOtpCode(PHONE);
  return VERIFY(
    jsonPost("/api/auth/otp/verify", {
      channel: "phone",
      identifier: PHONE,
      code,
      signup: DEFAULT_SIGNUP,
    }),
  );
}

describe("audit log", () => {
  it("records a login with ids only, at the clock time", async () => {
    const res = await login();
    expect(res.status).toBe(200);
    const docs = await (await getDb()).collection(AUDIT).find().toArray();
    expect(docs).toHaveLength(1);
    expect(docs[0]).toMatchObject({
      action: "auth.login",
      actor: { type: "user", role: "customer" },
      meta: { channel: "phone", isNewUser: true },
      at: clock.now(),
    });
    // No PII: the phone number appears nowhere in the entry.
    expect(JSON.stringify(docs[0])).not.toContain("9876543210");
  });

  it("registers its indexes", async () => {
    await ensureIndexes(await getDb());
    const names = (await (await getDb()).collection(AUDIT).indexes()).map((i) => i.name);
    expect(names).toEqual(expect.arrayContaining(["at_desc", "actorUserId_at_desc"]));
  });

  it("login still succeeds when the audit write fails (F7)", async () => {
    const { Collection } = await import("mongodb");
    const real = Collection.prototype.insertOne;
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const spy = vi.spyOn(Collection.prototype, "insertOne").mockImplementation(function (
      this: InstanceType<typeof Collection>,
      ...args: Parameters<typeof real>
    ) {
      if (this.collectionName === AUDIT) return Promise.reject(new Error("audit down"));
      return real.apply(this, args);
    } as typeof real);
    try {
      const res = await login();
      expect(res.status).toBe(200);
      expect(res.headers.get("set-cookie")).toMatch(/^__Host-aarv_sid=/);
      expect(err).toHaveBeenCalled();
    } finally {
      spy.mockRestore();
      err.mockRestore();
    }
  });

  it("appendAudit inserts a system entry", async () => {
    await appendAudit({ at: clock.now(), action: "auth.logout", actor: { type: "system" } });
    expect(await (await getDb()).collection(AUDIT).countDocuments()).toBe(1);
  });
});
