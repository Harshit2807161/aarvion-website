import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  OTP_COLLECTION,
  cancelOtpChallenge,
  issueOtpChallenge,
  resendCooldownSec,
  verifyOtpChallenge,
} from "@/server/auth/otp";
import { identifierKey } from "@/server/auth/identifier";
import { getDb } from "@/server/db/client";
import "@/server/db/register-all";
import { resetEnvForTests } from "@/server/env";
import { clearCollections, startMemoryReplSet, stopMemoryReplSet } from "../helpers/mongo";

beforeAll(async () => {
  vi.stubEnv("OTP_PEPPER", "x".repeat(64));
  resetEnvForTests();
  await startMemoryReplSet();
}, 120_000);
afterAll(async () => {
  await stopMemoryReplSet();
  vi.unstubAllEnvs();
  resetEnvForTests();
});
beforeEach(async () => {
  await clearCollections(OTP_COLLECTION);
});

const id = { channel: "phone", value: "+919876543210" } as const;
const T = new Date("2026-11-17T04:30:00Z");
const at = (ms: number) => new Date(T.getTime() + ms);

async function issue(now = T) {
  const r = await issueOtpChallenge(id, now);
  if (!r.ok) throw new Error("issue failed");
  return r;
}
async function stored() {
  const db = await getDb();
  return db.collection(OTP_COLLECTION).findOne({ _id: identifierKey(id) as never });
}

describe("issueOtpChallenge", () => {
  it("stores only a hash with the expected timings", async () => {
    const r = await issue();
    expect(r.code).toMatch(/^\d{6}$/);
    const doc = await stored();
    expect(doc).toMatchObject({
      attempts: 0,
      expiresAt: at(300_000),
      resendAvailableAt: at(30_000),
      consumedAt: null,
      challengeId: r.challengeId,
    });
    const { _id, ...fields } = doc!;
    expect(_id).toBe(identifierKey(id));
    expect(Object.values(fields)).not.toContain(r.code);
    expect(JSON.stringify(fields)).not.toContain(r.code);
  });

  it("enforces the resend cooldown, then replaces the challenge", async () => {
    const first = await issue();
    expect(await issueOtpChallenge(id, at(29_999))).toEqual({
      ok: false,
      reason: "cooldown",
      retryAfterSec: 1,
    });
    const second = await issueOtpChallenge(id, at(30_000));
    expect(second.ok).toBe(true);
    // The superseded code now faces the new challenge, so it is a mismatch (not "no challenge").
    expect(second.ok && second.code !== first.code).toBe(true);
    expect(await verifyOtpChallenge(id, first.code, at(30_001))).toEqual({
      ok: false,
      reason: "mismatch",
    });
  });

  it("lets exactly one of two parallel issues win", async () => {
    const rs = await Promise.all([issueOtpChallenge(id, T), issueOtpChallenge(id, T)]);
    expect(rs.filter((r) => r.ok)).toHaveLength(1);
  });
});

describe("verifyOtpChallenge", () => {
  it("accepts the right code once", async () => {
    const { code } = await issue();
    expect(await verifyOtpChallenge(id, code, at(1000))).toEqual({ ok: true });
    expect((await verifyOtpChallenge(id, code, at(2000))).ok).toBe(false);
  });

  it("locks after five wrong codes", async () => {
    const { code } = await issue();
    const wrong = code === "000000" ? "111111" : "000000";
    for (let n = 0; n < 5; n++) {
      expect(await verifyOtpChallenge(id, wrong, at(1000))).toEqual({
        ok: false,
        reason: "mismatch",
      });
    }
    expect((await verifyOtpChallenge(id, code, at(1000))).ok).toBe(false);
    expect((await stored())!.attempts).toBe(5);
  });

  it("stops parallel wrong verifies at the five-attempt cap", async () => {
    const { code } = await issue();
    const wrong = code === "000000" ? "111111" : "000000";
    const rs = await Promise.all(
      Array.from({ length: 12 }, () => verifyOtpChallenge(id, wrong, at(1000))),
    );
    expect(rs.some((r) => r.ok)).toBe(false);
    expect(rs.filter((r) => !r.ok && r.reason === "mismatch")).toHaveLength(5);
    expect(rs.filter((r) => !r.ok && r.reason === "no_active_challenge")).toHaveLength(7);
    expect((await stored())!.attempts).toBe(5);
    expect((await verifyOtpChallenge(id, code, at(1000))).ok).toBe(false);
  });

  it("checks expiry in the query at the 5:00 boundary", async () => {
    const a = await issue();
    expect(await verifyOtpChallenge(id, a.code, at(299_999))).toEqual({ ok: true });
    await clearCollections(OTP_COLLECTION);
    const b = await issue();
    expect(await verifyOtpChallenge(id, b.code, at(300_000))).toEqual({
      ok: false,
      reason: "no_active_challenge",
    });
    expect(await stored()).not.toBeNull();
  });

  it("lets exactly one of five parallel correct verifies succeed", async () => {
    const { code } = await issue();
    const rs = await Promise.all(
      Array.from({ length: 5 }, () => verifyOtpChallenge(id, code, at(1000))),
    );
    expect(rs.filter((r) => r.ok)).toHaveLength(1);
  });

  it("reports no_active_challenge for an unknown identifier", async () => {
    expect(await verifyOtpChallenge(id, "123456", T)).toEqual({
      ok: false,
      reason: "no_active_challenge",
    });
  });
});

describe("resendCooldownSec and cancel", () => {
  it("counts down to zero and is zero for unknown identifiers", async () => {
    expect(await resendCooldownSec(id, T)).toBe(0);
    await issue();
    expect(await resendCooldownSec(id, at(10_000))).toBe(20);
    expect(await resendCooldownSec(id, at(30_000))).toBe(0);
  });

  it("cancel removes the challenge and clears the cooldown", async () => {
    const { challengeId } = await issue();
    await cancelOtpChallenge(id, challengeId);
    expect(await stored()).toBeNull();
    expect(await resendCooldownSec(id, at(1000))).toBe(0);
  });
});
