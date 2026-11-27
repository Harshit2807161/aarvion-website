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
  type RxDoc,
} from "@/server/prescriptions/prescriptions";
import type { Role } from "@/server/auth/roles";
import { finishRxUpload, startRxUpload } from "@/server/prescriptions/upload";
import { RATE_LIMITS_COLLECTION } from "@/server/security/rate-limit";
import { jpegWithExif, pdf } from "../helpers/rx-fixtures";
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

  it("two concurrent finishes of one slot make exactly one record and keep one final file", async () => {
    const userId = uid();
    const store = getDeps().files;
    const puts: string[] = [];
    setDepsForTests({
      files: {
        kind: store.kind,
        put: (p, b, t) => (puts.push(p), store.put(p, b, t)),
        get: (p, o) => store.get(p, o),
        delete: (p) => store.delete(p),
      },
    });
    const started = await stage(userId, await jpegWithExif());
    const results = await Promise.all([
      finish(userId, started.stagingId),
      finish(userId, started.stagingId),
    ]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.filter((r) => !r.ok)).toEqual([{ ok: false, error: "upload_expired" }]);
    const records = await listRxForUser(userId);
    expect(records).toHaveLength(1);
    expect(await (await getDb()).collection(AUDIT).countDocuments({ action: "rx.upload" })).toBe(1);
    // The losing call deleted its own final file: only the stored record's file remains.
    const finals = puts.filter((k) => k.startsWith("rx/"));
    expect(finals).toHaveLength(2);
    for (const k of finals) expect((await store.get(k)) !== null).toBe(k === records[0]!.file.key);
  });

  it("stores a PDF unchanged, with its page count and a pdf record", async () => {
    const userId = uid();
    const bytes = pdf({ pages: 3 });
    const started = await stage(userId, bytes);
    const r = await finish(userId, started.stagingId);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.rx).toMatchObject({ kind: "pdf", pages: 3, status: "under_review" });
    const doc = (await listRxForUser(userId))[0]!;
    expect(doc.file).toMatchObject({ contentType: "application/pdf", kind: "pdf", pages: 3 });
    expect(doc.file.key).toMatch(/^rx\/[0-9a-f]{24}\/[0-9a-f]{24}\.pdf$/);
    const stored = await getDeps().files.get(doc.file.key);
    expect(Buffer.from(stored!.body).equals(Buffer.from(bytes))).toBe(true);
  });
});
