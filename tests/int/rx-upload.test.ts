import { ObjectId } from "mongodb";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { getDb } from "@/server/db/client";
import { getDeps, resetDepsForTests, setDepsForTests } from "@/server/deps";
import "@/server/db/register-all.ts";
import { ensureIndexes } from "@/server/db/indexes";
import { resetEnvForTests } from "@/server/env";
import { createFileStore } from "@/server/providers/file-store";
import {
  applyRxReview,
  createStaging,
  getRxForUser,
  insertRx,
  listRxForUser,
  peekStaging,
  PRESCRIPTIONS_COLLECTION,
  RX_STAGING_COLLECTION,
  RX_UPLOAD_LIMITS,
  type RxDoc,
} from "@/server/prescriptions/prescriptions";
import { finishRxUpload, startRxUpload } from "@/server/prescriptions/upload";
import { RATE_LIMITS_COLLECTION } from "@/server/security/rate-limit";
import { htmlAsJpgName, jpegWithExif, jpegWithTrailer } from "../helpers/rx-fixtures";
import { clearCollections, startMemoryReplSet, stopMemoryReplSet } from "../helpers/mongo";

const NOW = new Date("2026-11-27T10:00:00Z");
const AUDIT = "audit_logs";
const PATIENT = "Asha Kulkarni";
const uid = () => new ObjectId();
const body = (stagingId: string) => ({
  stagingId,
  patientName: PATIENT,
  declaration: true as const,
});

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
  await clearCollections(
    PRESCRIPTIONS_COLLECTION,
    RX_STAGING_COLLECTION,
    RATE_LIMITS_COLLECTION,
    AUDIT,
  );
});

async function stage(userId: ObjectId, bytes: Uint8Array) {
  const started = await startRxUpload({ userId, ipBucket: "1.2.3.4", now: NOW });
  if (!started.ok) throw new Error("start refused");
  await getDeps().files.put(started.key, bytes, "application/octet-stream");
  return started;
}

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

describe("finishRxUpload", () => {
  it("stores a validated, re-encoded record and audits it without the patient name", async () => {
    const userId = uid();
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const started = await stage(userId, await jpegWithExif());
    const r = await finishRxUpload({ userId, body: body(started.stagingId), now: NOW });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.rx).toMatchObject({ patientName: PATIENT, status: "under_review", kind: "image" });

    const docs = await (await getDb()).collection<RxDoc>(PRESCRIPTIONS_COLLECTION).find().toArray();
    expect(docs).toHaveLength(1);
    const doc = docs[0]!;
    expect(doc).toMatchObject({
      userId,
      patientName: PATIENT,
      status: "pending",
      review: null,
      rxDate: null,
      validUntil: null,
      declaration: { version: "2026-11-27", at: NOW },
      file: { contentType: "image/webp", kind: "image", pages: 1 },
    });
    expect(doc.file.key).toMatch(/^rx\/[0-9a-f]{24}\/[0-9a-f]{24}\.webp$/);
    expect(doc.file.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(doc)).not.toMatch(/\.jpe?g|filename|originalName/i);

    const files = getDeps().files;
    expect(await files.get(started.key)).toBeNull();
    expect(await files.get(doc.file.key)).not.toBeNull();

    const audit = await (await getDb()).collection(AUDIT).find({ action: "rx.upload" }).toArray();
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({
      actor: { type: "user", userId, role: "customer" },
      target: { type: "prescription", id: doc._id.toHexString() },
      meta: { kind: "image", pages: 1 },
    });
    expect(JSON.stringify(audit[0])).not.toContain(PATIENT);
    // Nothing logged carries the patient name.
    for (const spy of [err, log]) expect(JSON.stringify(spy.mock.calls)).not.toContain(PATIENT);
    err.mockRestore();
    log.mockRestore();
  });

  it("drops bytes appended after the image", async () => {
    const userId = uid();
    const started = await stage(userId, await jpegWithTrailer("<script>alert(1)</script>"));
    const r = await finishRxUpload({ userId, body: body(started.stagingId), now: NOW });
    expect(r.ok).toBe(true);
    const doc = (await listRxForUser(userId))[0]!;
    const stored = await getDeps().files.get(doc.file.key);
    expect(Buffer.from(stored!.body).toString("latin1")).not.toContain("<script>");
  });

  it("is single use, and a slot belongs to its user and expires at +15 minutes", async () => {
    const userId = uid();
    const started = await stage(userId, await jpegWithExif());
    expect((await finishRxUpload({ userId, body: body(started.stagingId), now: NOW })).ok).toBe(
      true,
    );
    expect(await finishRxUpload({ userId, body: body(started.stagingId), now: NOW })).toEqual({
      ok: false,
      error: "upload_expired",
    });

    const mine = await stage(userId, await jpegWithExif());
    expect(await finishRxUpload({ userId: uid(), body: body(mine.stagingId), now: NOW })).toEqual({
      ok: false,
      error: "upload_expired",
    });

    const late = await stage(userId, await jpegWithExif());
    const at = new Date(NOW.getTime() + 15 * 60_000);
    expect(await finishRxUpload({ userId, body: body(late.stagingId), now: at })).toEqual({
      ok: false,
      error: "upload_expired",
    });
  });

  it("refuses a disguised HTML file, stores nothing and deletes the staged file", async () => {
    const userId = uid();
    const started = await stage(userId, htmlAsJpgName());
    const r = await finishRxUpload({ userId, body: body(started.stagingId), now: NOW });
    expect(r).toEqual({ ok: false, error: "unsupported_type" });
    expect(await (await getDb()).collection(PRESCRIPTIONS_COLLECTION).countDocuments()).toBe(0);
    expect(await getDeps().files.get(started.key)).toBeNull();
  });

  it("answers file_missing when nothing was staged", async () => {
    const userId = uid();
    const started = await startRxUpload({ userId, ipBucket: "b", now: NOW });
    if (!started.ok) throw new Error("start refused");
    expect(await finishRxUpload({ userId, body: body(started.stagingId), now: NOW })).toEqual({
      ok: false,
      error: "file_missing",
    });
  });

  it("answers too_large for a staged file over the cap, and deletes it", async () => {
    const userId = uid();
    const started = await stage(userId, new Uint8Array(8_388_609));
    expect(await finishRxUpload({ userId, body: body(started.stagingId), now: NOW })).toEqual({
      ok: false,
      error: "too_large",
    });
    expect(await getDeps().files.get(started.key)).toBeNull();
  });

  it("removes the final file when the insert fails", async () => {
    const userId = uid();
    const store = getDeps().files;
    const puts: string[] = [];
    setDepsForTests({
      files: {
        kind: store.kind,
        put: (path, bytes, type) => (puts.push(path), store.put(path, bytes, type)),
        get: (path, opts) => store.get(path, opts),
        delete: (path) => store.delete(path),
      },
    });
    const started = await stage(userId, await jpegWithExif());
    const { Collection } = await import("mongodb");
    const real = Collection.prototype.insertOne;
    const spy = vi.spyOn(Collection.prototype, "insertOne").mockImplementation(function (
      this: InstanceType<typeof Collection>,
      ...args: Parameters<typeof real>
    ) {
      if (this.collectionName === PRESCRIPTIONS_COLLECTION)
        return Promise.reject(new Error("down"));
      return real.apply(this, args);
    } as typeof real);
    try {
      await expect(
        finishRxUpload({ userId, body: body(started.stagingId), now: NOW }),
      ).rejects.toThrow("down");
    } finally {
      spy.mockRestore();
    }
    const finalKey = puts.find((k) => k.startsWith("rx/"));
    expect(finalKey).toBeDefined();
    expect(await store.get(finalKey!)).toBeNull();
  });

  it("treats a put that already landed with the same bytes as success (Blob retry)", async () => {
    const userId = uid();
    const store = getDeps().files;
    const { FileExistsError } = await import("@/server/providers/file-keys");
    setDepsForTests({
      files: {
        kind: store.kind,
        put: async (path, bytes, type) => {
          await store.put(path, bytes, type);
          if (path.startsWith("rx/")) throw new FileExistsError();
        },
        get: (path, opts) => store.get(path, opts),
        delete: (path) => store.delete(path),
      },
    });
    const started = await stage(userId, await jpegWithExif());
    const r = await finishRxUpload({ userId, body: body(started.stagingId), now: NOW });
    expect(r.ok).toBe(true);
  });
});

describe("records", () => {
  async function insertOne(userId: ObjectId): Promise<RxDoc> {
    const started = await stage(userId, await jpegWithExif());
    const r = await finishRxUpload({ userId, body: body(started.stagingId), now: NOW });
    if (!r.ok) throw new Error("finish refused");
    return (await listRxForUser(userId))[0]!;
  }

  it("reads only the owner's record", async () => {
    const userId = uid();
    const doc = await insertOne(userId);
    expect((await getRxForUser(doc._id, userId))?._id).toEqual(doc._id);
    expect(await getRxForUser(doc._id, uid())).toBeNull();
  });

  it("lists newest first", async () => {
    const userId = uid();
    const a = await insertOne(userId);
    const b: RxDoc = { ...a, _id: new ObjectId(), createdAt: new Date(NOW.getTime() + 1000) };
    await insertRx(b);
    expect((await listRxForUser(userId)).map((d) => d._id.toHexString())).toEqual([
      b._id.toHexString(),
      a._id.toHexString(),
    ]);
  });

  it("applies a review once, conditional on the status it was read in", async () => {
    const doc = await insertOne(uid());
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
    expect(await applyRxReview(doc._id, "pending", set, NOW)).toBe(true);
    expect(await applyRxReview(doc._id, "pending", set, NOW)).toBe(false);
  });

  it("creates staging slots with a TTL", async () => {
    const slot = await createStaging(uid(), NOW);
    expect(slot.expiresAt).toEqual(new Date(NOW.getTime() + 15 * 60_000));
  });
});

describe("indexes", () => {
  it("registers the three prescription indexes", async () => {
    const db = await getDb();
    await ensureIndexes(db);
    const names = async (c: string) => (await db.collection(c).indexes()).map((i) => i.name);
    expect(await names(PRESCRIPTIONS_COLLECTION)).toEqual(
      expect.arrayContaining(["userId_createdAt_desc", "status_createdAt"]),
    );
    expect(await names(RX_STAGING_COLLECTION)).toContain("expiresAt_ttl");
  });
});
