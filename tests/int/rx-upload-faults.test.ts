import { MongoServerError, ObjectId } from "mongodb";
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
} from "@/server/prescriptions/prescriptions";
import type { Role } from "@/server/auth/roles";
import { checkRxFile } from "@/server/prescriptions/file-check";
import { finishRxUpload, startRxUpload } from "@/server/prescriptions/upload";
import { RATE_LIMITS_COLLECTION } from "@/server/security/rate-limit";
import { htmlAsJpgName, jpegWithExif, jpegWithTrailer } from "../helpers/rx-fixtures";
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

describe("finishRxUpload", () => {
  it("drops bytes appended after the image", async () => {
    const userId = uid();
    const started = await stage(userId, await jpegWithTrailer("<script>alert(1)</script>"));
    const r = await finish(userId, started.stagingId);
    expect(r.ok).toBe(true);
    const doc = (await listRxForUser(userId))[0]!;
    const stored = await getDeps().files.get(doc.file.key);
    expect(Buffer.from(stored!.body).toString("latin1")).not.toContain("<script>");
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

  it("writes the record and its audit row together, with the caller's role", async () => {
    const userId = uid();
    const started = await stage(userId, await jpegWithExif());
    expect((await finish(userId, started.stagingId, NOW, "pharmacist")).ok).toBe(true);
    const audit = await (await getDb()).collection(AUDIT).find({ action: "rx.upload" }).toArray();
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({ actor: { type: "user", userId, role: "pharmacist" } });
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

  it("keeps the staged file and the slot when the PDF check is busy, so a retry works", async () => {
    const userId = uid();
    const started = await stage(userId, await jpegWithExif());
    vi.mocked(checkRxFile).mockResolvedValueOnce({ ok: false, error: "busy" });
    expect(await finish(userId, started.stagingId)).toEqual({ ok: false, error: "busy" });
    expect(await getDeps().files.get(started.key)).not.toBeNull();
    expect(await peekStaging(started.stagingId, userId, NOW)).not.toBeNull();
    expect((await finish(userId, started.stagingId)).ok).toBe(true);
    expect(await listRxForUser(userId)).toHaveLength(1);
  });

  it("keeps the final file when the commit result is unknown but the record committed", async () => {
    const userId = uid();
    const started = await stage(userId, await jpegWithExif());
    const { ClientSession } = await import("mongodb");
    const real = ClientSession.prototype.commitTransaction;
    const spy = vi
      .spyOn(ClientSession.prototype, "commitTransaction")
      .mockImplementation(async function (this: InstanceType<typeof ClientSession>) {
        await real.call(this);
        // MaxTimeMSExpired is not retried by the driver: the outcome stays unknown.
        throw new MongoServerError({ message: "commit timed out", code: 50 });
      });
    try {
      const r = await finish(userId, started.stagingId);
      expect(r.ok).toBe(true);
    } finally {
      spy.mockRestore();
    }
    const doc = (await listRxForUser(userId))[0]!;
    expect(await getDeps().files.get(doc.file.key)).not.toBeNull();
    expect(await (await getDb()).collection(AUDIT).countDocuments({ action: "rx.upload" })).toBe(1);
  });

  it("deletes the final file when the commit fails and no record exists", async () => {
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
    const { ClientSession } = await import("mongodb");
    const spy = vi
      .spyOn(ClientSession.prototype, "commitTransaction")
      .mockRejectedValue(new MongoServerError({ message: "commit timed out", code: 50 }));
    try {
      await expect(finish(userId, started.stagingId)).rejects.toThrow("commit timed out");
    } finally {
      spy.mockRestore();
    }
    const finalKey = puts.find((k) => k.startsWith("rx/"))!;
    expect(await store.get(finalKey)).toBeNull();
    expect(await listRxForUser(userId)).toHaveLength(0);
  });
});
