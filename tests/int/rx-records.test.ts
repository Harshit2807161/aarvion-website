import { ObjectId } from "mongodb";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { getDb } from "@/server/db/client";
import "@/server/db/register-all.ts";
import { ensureIndexes } from "@/server/db/indexes";
import { resetEnvForTests } from "@/server/env";
import {
  applyRxReview,
  createStaging,
  getRxForUser,
  insertRx,
  listRxForUser,
  peekStaging,
  PRESCRIPTIONS_COLLECTION,
  RxCreateBody,
  RX_STAGING_COLLECTION,
  takeStaging,
  type RxDoc,
} from "@/server/prescriptions/prescriptions";
import { clearCollections, startMemoryReplSet, stopMemoryReplSet } from "../helpers/mongo";

const NOW = new Date("2026-11-27T10:00:00Z");
const MIN = 60_000;
const uid = () => new ObjectId();

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
beforeEach(() => clearCollections(PRESCRIPTIONS_COLLECTION, RX_STAGING_COLLECTION));

function doc(userId: ObjectId, createdAt = NOW): RxDoc {
  return {
    _id: new ObjectId(),
    userId,
    patientName: "Asha Kulkarni",
    declaration: { version: "2026-11-27", at: createdAt },
    file: {
      key: "rx/a/b.webp",
      contentType: "image/webp",
      kind: "image",
      pages: 1,
      bytes: 1000,
      sha256: "0".repeat(64),
    },
    status: "pending",
    review: null,
    rxDate: null,
    validUntil: null,
    createdAt,
    updatedAt: createdAt,
  };
}

describe("staging slots", () => {
  it("creates a slot under the user's prefix that lives 15 minutes", async () => {
    const userId = uid();
    const slot = await createStaging(userId, NOW);
    expect(slot._id).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(slot.key).toBe(`rx-staging/${userId.toHexString()}/${slot._id}`);
    expect(slot.expiresAt).toEqual(new Date(NOW.getTime() + 15 * MIN));
    expect((await peekStaging(slot._id, userId, NOW))?._id).toBe(slot._id);
  });

  it("is single use, belongs to its user and is gone at +15 minutes exactly", async () => {
    const userId = uid();
    const slot = await createStaging(userId, NOW);
    expect(await takeStaging(slot._id, uid(), NOW)).toBeNull();
    expect(await takeStaging(slot._id, userId, new Date(NOW.getTime() + 15 * MIN))).toBeNull();
    expect((await takeStaging(slot._id, userId, new Date(NOW.getTime() + 15 * MIN - 1)))?._id).toBe(
      slot._id,
    );
    expect(await takeStaging(slot._id, userId, NOW)).toBeNull();
  });
});

describe("records", () => {
  it("reads only the owner's record", async () => {
    const userId = uid();
    const d = doc(userId);
    await insertRx(d);
    expect((await getRxForUser(d._id, userId))?._id).toEqual(d._id);
    expect(await getRxForUser(d._id, uid())).toBeNull();
  });

  it("lists the user's records newest first, and only theirs", async () => {
    const userId = uid();
    const a = doc(userId);
    const b = doc(userId, new Date(NOW.getTime() + 1000));
    await insertRx(a);
    await insertRx(b);
    await insertRx(doc(uid()));
    expect((await listRxForUser(userId)).map((d) => d._id.toHexString())).toEqual([
      b._id.toHexString(),
      a._id.toHexString(),
    ]);
    expect(await listRxForUser(userId, 1)).toHaveLength(1);
  });

  it("applies a review once, conditional on the status it was read in", async () => {
    const d = doc(uid());
    await insertRx(d);
    const set = {
      status: "rejected" as const,
      review: {
        kind: "rejected" as const,
        by: "p1",
        at: NOW,
        reason: "unreadable" as const,
        note: null,
        revoked: false,
      },
    };
    expect(await applyRxReview(d._id, "pending", set, NOW)).toBe(true);
    expect(await applyRxReview(d._id, "pending", set, NOW)).toBe(false);
    expect((await getRxForUser(d._id, d.userId))?.status).toBe("rejected");
  });
});

describe("RxCreateBody", () => {
  const ok = { stagingId: "A".repeat(22), patientName: "Asha Kulkarni", declaration: true };

  it("accepts the three fields and trims the name", () => {
    expect(RxCreateBody.parse({ ...ok, patientName: "  Asha Kulkarni " }).patientName).toBe(
      "Asha Kulkarni",
    );
  });

  it.each([
    ["a short slot id", { stagingId: "short" }],
    ["an unticked declaration", { declaration: false }],
    ["a one-letter name", { patientName: "A" }],
    ["an unknown key", { extra: 1 }],
  ])("refuses %s", (_label, patch) => {
    expect(RxCreateBody.safeParse({ ...ok, ...patch }).success).toBe(false);
  });
});

describe("indexes", () => {
  it("registers the prescription and staging indexes", async () => {
    const db = await getDb();
    await ensureIndexes(db);
    const names = async (c: string) => (await db.collection(c).indexes()).map((i) => i.name);
    expect(await names(PRESCRIPTIONS_COLLECTION)).toEqual(
      expect.arrayContaining(["userId_createdAt_desc", "status_createdAt"]),
    );
    expect(await names(RX_STAGING_COLLECTION)).toContain("expiresAt_ttl");
  });
});
