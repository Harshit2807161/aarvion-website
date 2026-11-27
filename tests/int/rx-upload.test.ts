import { ClientSession, Collection, MongoServerError, ObjectId } from "mongodb";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { getDb } from "@/server/db/client";
import { getDeps, resetDepsForTests, setDepsForTests } from "@/server/deps";
import "@/server/db/register-all.ts";
import { resetEnvForTests } from "@/server/env";
import { createFileStore } from "@/server/providers/file-store";
import {
  claimStaging,
  listRxForUser,
  peekStaging,
  PRESCRIPTIONS_COLLECTION,
  RX_STAGING_COLLECTION,
  type RxDoc,
} from "@/server/prescriptions/prescriptions";
import type { Role } from "@/server/auth/roles";
import { checkRxFile } from "@/server/prescriptions/file-check";
import { finishRxUpload, startRxUpload } from "@/server/prescriptions/upload";
import { RATE_LIMITS_COLLECTION } from "@/server/security/rate-limit";
import { jpegWithExif } from "../helpers/rx-fixtures";
import { clearCollections, startMemoryReplSet, stopMemoryReplSet } from "../helpers/mongo";

vi.mock("@/server/prescriptions/file-check", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/server/prescriptions/file-check")>();
  return { ...actual, checkRxFile: vi.fn(actual.checkRxFile) };
});

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

/** Wraps the file store to record every final (rx/...) put. */
function trackPuts() {
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
  return { store, finals: () => puts.filter((k) => k.startsWith("rx/")) };
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

  it("aborts without a record when the audit write fails, and the slot stays free for a retry", async () => {
    const userId = uid();
    const { finals } = trackPuts();
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
    // The aborted attempt's final file was dropped: only the stored record's file remains.
    const kept = (await listRxForUser(userId))[0]!.file.key;
    for (const k of finals()) expect((await getDeps().files.get(k)) !== null).toBe(k === kept);
  });

  it("keeps the staged file and the slot when the PDF check is busy, so a retry works", async () => {
    const userId = uid();
    const started = await stage(userId, await jpegWithExif());
    vi.mocked(checkRxFile).mockResolvedValueOnce({ ok: false, error: "busy" });
    expect(await finish(userId, started.stagingId)).toEqual({ ok: false, error: "busy" });
    expect(await getDeps().files.get(started.key)).not.toBeNull();
    expect(await peekStaging(started.stagingId, userId, NOW)).not.toBeNull();
    expect((await finish(userId, started.stagingId)).ok).toBe(true);
  });

  it("passes majority write and read concern to the transaction", async () => {
    const userId = uid();
    const spy = vi.spyOn(ClientSession.prototype, "withTransaction");
    const started = await stage(userId, await jpegWithExif());
    await finish(userId, started.stagingId);
    const options = spy.mock.calls[0]?.[1];
    spy.mockRestore();
    expect(options).toMatchObject({
      writeConcern: { w: "majority" },
      readConcern: { level: "majority" },
    });
  });

  it("leases the slot: a concurrent finish gets busy and does none of the work", async () => {
    const userId = uid();
    const { finals } = trackPuts();
    const started = await stage(userId, await jpegWithExif());
    const actual = await vi.importActual<typeof import("@/server/prescriptions/file-check")>(
      "@/server/prescriptions/file-check",
    );
    // Park the first finish inside its check, so the second is certain to arrive while it holds the lease.
    let release!: () => void;
    let parked!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    const inCheck = new Promise<void>((resolve) => (parked = resolve));
    vi.mocked(checkRxFile).mockClear();
    vi.mocked(checkRxFile).mockImplementationOnce(async (bytes) => {
      parked();
      await gate;
      return actual.checkRxFile(bytes);
    });
    const first = finish(userId, started.stagingId);
    await inCheck;
    expect(await finish(userId, started.stagingId)).toEqual({ ok: false, error: "busy" });
    release();
    expect((await first).ok).toBe(true);
    expect(vi.mocked(checkRxFile)).toHaveBeenCalledTimes(1);
    expect(finals()).toHaveLength(1);
    expect(await listRxForUser(userId)).toHaveLength(1);
    // Once it is done the slot is gone.
    expect(await finish(userId, started.stagingId)).toEqual({ ok: false, error: "upload_expired" });
  });

  it("lets a crashed claim expire, then finishes", async () => {
    const userId = uid();
    const started = await stage(userId, await jpegWithExif());
    await claimStaging(started.stagingId, userId, NOW);
    expect(await finish(userId, started.stagingId)).toEqual({ ok: false, error: "busy" });
    const later = new Date(NOW.getTime() + 31_000);
    expect((await finish(userId, started.stagingId, later)).ok).toBe(true);
  });

  it("releases the lease on a busy PDF check, and consumes the slot on a refusal", async () => {
    const userId = uid();
    const busy = await stage(userId, await jpegWithExif());
    vi.mocked(checkRxFile).mockResolvedValueOnce({ ok: false, error: "busy" });
    expect(await finish(userId, busy.stagingId)).toEqual({ ok: false, error: "busy" });
    expect((await finish(userId, busy.stagingId)).ok).toBe(true);
    const bad = await stage(userId, new Uint8Array([1, 2, 3]));
    expect(await finish(userId, bad.stagingId)).toEqual({ ok: false, error: "unsupported_type" });
    expect(await peekStaging(bad.stagingId, userId, NOW)).toBeNull();
  });

  /** The commit may apply, then reports an unknown result (code 50 is not retried by the driver). */
  function unknownCommit(applies: boolean) {
    const real = ClientSession.prototype.commitTransaction;
    return vi
      .spyOn(ClientSession.prototype, "commitTransaction")
      .mockImplementation(async function (this: InstanceType<typeof ClientSession>) {
        if (applies) await real.call(this);
        throw new MongoServerError({ message: "commit timed out", code: 50 });
      });
  }

  it("succeeds, keeping the file, when the commit result is unknown but the record committed", async () => {
    const userId = uid();
    const started = await stage(userId, await jpegWithExif());
    const spy = unknownCommit(true);
    try {
      expect((await finish(userId, started.stagingId)).ok).toBe(true);
    } finally {
      spy.mockRestore();
    }
    const doc = (await listRxForUser(userId))[0]!;
    expect(await getDeps().files.get(doc.file.key)).not.toBeNull();
  });

  it("keeps the file and rethrows when the commit result is unknown and no record is found", async () => {
    const userId = uid();
    const { finals, store } = trackPuts();
    const started = await stage(userId, await jpegWithExif());
    const spy = unknownCommit(false);
    try {
      await expect(finish(userId, started.stagingId)).rejects.toThrow("commit timed out");
    } finally {
      spy.mockRestore();
    }
    expect(await store.get(finals()[0]!)).not.toBeNull();
  });

  it("keeps the file when the commit result is unknown and the follow-up read fails", async () => {
    const userId = uid();
    const { finals, store } = trackPuts();
    const started = await stage(userId, await jpegWithExif());
    const commit = unknownCommit(true);
    const real = Collection.prototype.findOne;
    const find = vi.spyOn(Collection.prototype, "findOne").mockImplementation(function (
      this: InstanceType<typeof Collection>,
      ...args: Parameters<typeof real>
    ) {
      if (this.collectionName === PRESCRIPTIONS_COLLECTION) {
        return Promise.reject(new Error("read down"));
      }
      return real.apply(this, args);
    } as typeof real);
    try {
      await expect(finish(userId, started.stagingId)).rejects.toThrow("commit timed out");
    } finally {
      commit.mockRestore();
      find.mockRestore();
    }
    // The commit applied, so the record exists and its file must too.
    const doc = (await listRxForUser(userId))[0]!;
    expect(finals()).toEqual([doc.file.key]);
    expect(await store.get(doc.file.key)).not.toBeNull();
  });
});
