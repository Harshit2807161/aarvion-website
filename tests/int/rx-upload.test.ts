import { ObjectId } from "mongodb";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { getDb } from "@/server/db/client";
import { getDeps, resetDepsForTests, setDepsForTests } from "@/server/deps";
import "@/server/db/register-all.ts";
import { resetEnvForTests } from "@/server/env";
import { createFileStore } from "@/server/providers/file-store";
import {
  listRxForUser,
  peekStaging,
  PRESCRIPTIONS_COLLECTION,
  RX_STAGING_COLLECTION,
  RX_UPLOAD_LIMITS,
  type RxDoc,
} from "@/server/prescriptions/prescriptions";
import type { Role } from "@/server/auth/roles";
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

const finish = (userId: ObjectId, stagingId: string, now = NOW, role: Role = "customer") =>
  finishRxUpload({ userId, role, body: body(stagingId), now });

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
    const r = await finish(userId, started.stagingId);
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
    const r = await finish(userId, started.stagingId);
    expect(r.ok).toBe(true);
    const doc = (await listRxForUser(userId))[0]!;
    const stored = await getDeps().files.get(doc.file.key);
    expect(Buffer.from(stored!.body).toString("latin1")).not.toContain("<script>");
  });

  it("is single use, and a slot belongs to its user and expires at +15 minutes", async () => {
    const userId = uid();
    const started = await stage(userId, await jpegWithExif());
    expect((await finish(userId, started.stagingId)).ok).toBe(true);
    expect(await finish(userId, started.stagingId)).toEqual({
      ok: false,
      error: "upload_expired",
    });

    const mine = await stage(userId, await jpegWithExif());
    expect(await finish(uid(), mine.stagingId)).toEqual({
      ok: false,
      error: "upload_expired",
    });

    const late = await stage(userId, await jpegWithExif());
    const at = new Date(NOW.getTime() + 15 * 60_000);
    expect(await finish(userId, late.stagingId, at)).toEqual({
      ok: false,
      error: "upload_expired",
    });
  });

  it("refuses a disguised HTML file, stores nothing and deletes the staged file", async () => {
    const userId = uid();
    const started = await stage(userId, htmlAsJpgName());
    const r = await finish(userId, started.stagingId);
    expect(r).toEqual({ ok: false, error: "unsupported_type" });
    expect(await (await getDb()).collection(PRESCRIPTIONS_COLLECTION).countDocuments()).toBe(0);
    expect(await getDeps().files.get(started.key)).toBeNull();
  });

  it("answers file_missing when nothing was staged", async () => {
    const userId = uid();
    const started = await startRxUpload({ userId, ipBucket: "b", now: NOW });
    if (!started.ok) throw new Error("start refused");
    expect(await finish(userId, started.stagingId)).toEqual({
      ok: false,
      error: "file_missing",
    });
  });

  it("answers too_large for a staged file over the cap, and deletes it", async () => {
    const userId = uid();
    const started = await stage(userId, new Uint8Array(8_388_609));
    expect(await finish(userId, started.stagingId)).toEqual({
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
      await expect(finish(userId, started.stagingId)).rejects.toThrow("down");
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
    const r = await finish(userId, started.stagingId);
    expect(r.ok).toBe(true);
  });

  it("writes the record and its audit row together, with the caller's role", async () => {
    const userId = uid();
    const started = await stage(userId, await jpegWithExif());
    expect((await finish(userId, started.stagingId, NOW, "pharmacist")).ok).toBe(true);
    const audit = await (await getDb()).collection(AUDIT).find({ action: "rx.upload" }).toArray();
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({ actor: { type: "user", userId, role: "pharmacist" } });
  });

  it("aborts without a record when the audit write fails, and the slot stays free for a retry", async () => {
    const userId = uid();
    const started = await stage(userId, await jpegWithExif());
    const { Collection } = await import("mongodb");
    const real = Collection.prototype.insertOne;
    const spy = vi.spyOn(Collection.prototype, "insertOne").mockImplementation(function (
      this: InstanceType<typeof Collection>,
      ...args: Parameters<typeof real>
    ) {
      if (this.collectionName === AUDIT) return Promise.reject(new Error("audit down"));
      return real.apply(this, args);
    } as typeof real);
    try {
      await expect(finish(userId, started.stagingId)).rejects.toThrow("audit down");
    } finally {
      spy.mockRestore();
    }
    expect(await (await getDb()).collection(PRESCRIPTIONS_COLLECTION).countDocuments()).toBe(0);
    expect(await peekStaging(started.stagingId, userId, NOW)).not.toBeNull();
    // The staged file is still there, so the same slot finishes on a retry.
    expect((await finish(userId, started.stagingId)).ok).toBe(true);
    expect(await (await getDb()).collection(PRESCRIPTIONS_COLLECTION).countDocuments()).toBe(1);
    expect(await (await getDb()).collection(AUDIT).countDocuments({ action: "rx.upload" })).toBe(1);
  });

  it("two concurrent finishes of one slot make exactly one record", async () => {
    const userId = uid();
    const started = await stage(userId, await jpegWithExif());
    const results = await Promise.all([
      finish(userId, started.stagingId),
      finish(userId, started.stagingId),
    ]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.filter((r) => !r.ok)).toEqual([{ ok: false, error: "upload_expired" }]);
    expect(await listRxForUser(userId)).toHaveLength(1);
    expect(await (await getDb()).collection(AUDIT).countDocuments({ action: "rx.upload" })).toBe(1);
  });

  it("still succeeds when deleting the staged file fails afterwards", async () => {
    const userId = uid();
    const store = getDeps().files;
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    setDepsForTests({
      files: {
        kind: store.kind,
        put: (p, b, t) => store.put(p, b, t),
        get: (p, o) => store.get(p, o),
        delete: async (p) => {
          if (p.startsWith("rx-staging/")) throw new Error("blob down");
        },
      },
    });
    const started = await stage(userId, await jpegWithExif());
    expect((await finish(userId, started.stagingId)).ok).toBe(true);
    expect(await listRxForUser(userId)).toHaveLength(1);
    expect(await (await getDb()).collection(AUDIT).countDocuments({ action: "rx.upload" })).toBe(1);
    expect(JSON.stringify(err.mock.calls)).not.toContain(PATIENT);
    err.mockRestore();
  });

  it("rethrows the insert error even when removing the final file also fails", async () => {
    const userId = uid();
    const store = getDeps().files;
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    setDepsForTests({
      files: {
        kind: store.kind,
        put: (p, b, t) => store.put(p, b, t),
        get: (p, o) => store.get(p, o),
        delete: async (p) => {
          if (p.startsWith("rx/")) throw new Error("blob down");
        },
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
        return Promise.reject(new Error("insert down"));
      return real.apply(this, args);
    } as typeof real);
    try {
      await expect(finish(userId, started.stagingId)).rejects.toThrow("insert down");
    } finally {
      spy.mockRestore();
      err.mockRestore();
    }
  });

  it("re-parses its input: an operator object or a bad name never reaches Mongo", async () => {
    const userId = uid();
    const bad = { stagingId: { $ne: null }, patientName: PATIENT, declaration: true };
    await expect(
      finishRxUpload({ userId, role: "customer", body: bad as never, now: NOW }),
    ).rejects.toThrow();
  });
});
