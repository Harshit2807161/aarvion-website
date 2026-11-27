import { ObjectId } from "mongodb";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { resetDepsForTests, setDepsForTests } from "@/server/deps";
import "@/server/db/register-all.ts";
import { resetEnvForTests } from "@/server/env";
import { createFileStore } from "@/server/providers/file-store";
import {
  peekStaging,
  RX_STAGING_COLLECTION,
  RX_UPLOAD_LIMITS,
} from "@/server/prescriptions/prescriptions";
import { startRxUpload } from "@/server/prescriptions/upload";
import { RATE_LIMITS_COLLECTION } from "@/server/security/rate-limit";
import { clearCollections, startMemoryReplSet, stopMemoryReplSet } from "../helpers/mongo";

const NOW = new Date("2026-11-27T10:00:00Z");
const uid = () => new ObjectId();

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
  setDepsForTests({ files: createFileStore({ FILE_STORE: "memory" } as never) });
  await clearCollections(RX_STAGING_COLLECTION, RATE_LIMITS_COLLECTION);
});

describe("startRxUpload", () => {
  it("issues a single-use slot under the user's staging prefix, direct on a non-blob store", async () => {
    const userId = uid();
    const r = await startRxUpload({ userId, ipBucket: "b", now: NOW });
    expect(r).toMatchObject({ ok: true, mode: "direct" });
    if (!r.ok) return;
    expect(r.stagingId).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(r.key).toBe(`rx-staging/${userId.toHexString()}/${r.stagingId}`);
    const doc = await peekStaging(r.stagingId, userId, NOW);
    expect(doc?.expiresAt).toEqual(new Date(NOW.getTime() + 15 * 60_000));
  });

  it("limits a user to 10 starts an hour", async () => {
    const userId = uid();
    for (let i = 0; i < RX_UPLOAD_LIMITS.user.limit; i++) {
      expect((await startRxUpload({ userId, ipBucket: `b${i}`, now: NOW })).ok).toBe(true);
    }
    const eleventh = await startRxUpload({ userId, ipBucket: "b-x", now: NOW });
    expect(eleventh).toMatchObject({ ok: false, error: "rate_limited" });
  });

  it("limits an IP bucket to 30 starts an hour, checked before the user budget", async () => {
    for (let i = 0; i < RX_UPLOAD_LIMITS.ip.limit; i++) {
      expect((await startRxUpload({ userId: uid(), ipBucket: "same", now: NOW })).ok).toBe(true);
    }
    const victim = uid();
    const blocked = await startRxUpload({ userId: victim, ipBucket: "same", now: NOW });
    expect(blocked).toMatchObject({ ok: false, error: "rate_limited" });
    // The blocked IP spent none of the victim's own budget.
    for (let i = 0; i < RX_UPLOAD_LIMITS.user.limit; i++) {
      expect((await startRxUpload({ userId: victim, ipBucket: `other${i}`, now: NOW })).ok).toBe(
        true,
      );
    }
  });
});
