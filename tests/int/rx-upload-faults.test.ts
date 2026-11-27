import { ClientSession, Collection, MongoServerError } from "mongodb";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getDb } from "@/server/db/client";
import { getDeps } from "@/server/deps";
import {
  claimStaging,
  consumeStaging,
  listRxForUser,
  peekStaging,
  PRESCRIPTIONS_COLLECTION,
  releaseStaging,
} from "@/server/prescriptions/prescriptions";
import { FileExistsError } from "@/server/providers/file-keys";
import { jpegWithExif } from "../helpers/rx-fixtures";
import {
  AUDIT,
  finish,
  NOW,
  PATIENT,
  stage,
  trackFiles,
  uid,
  setupRxUploadHarness,
} from "../helpers/rx-upload";

setupRxUploadHarness();
afterEach(() => vi.restoreAllMocks());

const count = async (c: string) => (await getDb()).collection(c).countDocuments();
const at = (ms: number) => new Date(NOW.getTime() + ms);

/** Makes inserts into one collection fail. */
function failInsert(collection: string, message: string) {
  const real = Collection.prototype.insertOne;
  return vi.spyOn(Collection.prototype, "insertOne").mockImplementation(function (
    this: InstanceType<typeof Collection>,
    ...args: Parameters<typeof real>
  ) {
    if (this.collectionName === collection) return Promise.reject(new Error(message));
    return real.apply(this, args);
  } as typeof real);
}

describe("finishRxUpload cleanup and retries", () => {
  it("removes the final file when the insert fails, and keeps the insert error if cleanup fails too", async () => {
    const userId = uid();
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const { finals, store } = trackFiles({
      delete: async (p) => {
        if (p.startsWith("rx/")) throw new Error("blob down");
      },
    });
    const started = await stage(userId, await jpegWithExif());
    failInsert(PRESCRIPTIONS_COLLECTION, "insert down");
    await expect(finish(userId, started.stagingId)).rejects.toThrow("insert down");
    expect(finals()).toHaveLength(1);
    // The delete failed, so the file is an orphan for the sweep; no log carries the patient name.
    expect(await store.get(finals()[0]!)).not.toBeNull();
    expect(JSON.stringify(err.mock.calls)).not.toContain(PATIENT);
  });

  it("deletes the final file after a failed insert, and the same slot retries", async () => {
    const userId = uid();
    const { finals, store } = trackFiles();
    const started = await stage(userId, await jpegWithExif());
    const spy = failInsert(PRESCRIPTIONS_COLLECTION, "insert down");
    await expect(finish(userId, started.stagingId)).rejects.toThrow("insert down");
    spy.mockRestore();
    expect(await store.get(finals()[0]!)).toBeNull();
    expect(await peekStaging(started.stagingId, userId, NOW)).not.toBeNull();
    expect((await finish(userId, started.stagingId)).ok).toBe(true);
  });

  it("counts a put that already landed with the same bytes as success (Blob retry)", async () => {
    const userId = uid();
    const store = getDeps().files;
    trackFiles({
      put: async (p, b, t) => {
        await store.put(p, b, t);
        if (p.startsWith("rx/")) throw new FileExistsError();
      },
    });
    const started = await stage(userId, await jpegWithExif());
    expect((await finish(userId, started.stagingId)).ok).toBe(true);
  });

  it("rethrows a put conflict with different bytes, and releases the lease for a retry", async () => {
    const userId = uid();
    const store = getDeps().files;
    let fail = true;
    trackFiles({
      put: async (p, b, t) => {
        if (fail && p.startsWith("rx/")) {
          await store.put(p, new Uint8Array([9, 9, 9]), t);
          throw new FileExistsError();
        }
        await store.put(p, b, t);
      },
    });
    const started = await stage(userId, await jpegWithExif());
    await expect(finish(userId, started.stagingId)).rejects.toBeInstanceOf(FileExistsError);
    fail = false;
    expect((await finish(userId, started.stagingId)).ok).toBe(true);
  });

  it("still succeeds when deleting the staged file fails afterwards", async () => {
    const userId = uid();
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    trackFiles({
      delete: async (p) => {
        if (p.startsWith("rx-staging/")) throw new Error("blob down");
      },
    });
    const started = await stage(userId, await jpegWithExif());
    expect((await finish(userId, started.stagingId)).ok).toBe(true);
    expect(await listRxForUser(userId)).toHaveLength(1);
    expect(await count(AUDIT)).toBe(1);
    expect(JSON.stringify(err.mock.calls)).not.toContain(PATIENT);
  });
});

describe("the slot lease", () => {
  it("is claimable exactly at the lease end, not a millisecond before", async () => {
    const userId = uid();
    const started = await stage(userId, await jpegWithExif());
    expect(await claimStaging(started.stagingId, userId, NOW)).not.toBeNull();
    expect(await claimStaging(started.stagingId, userId, at(29_999))).toBeNull();
    expect(await claimStaging(started.stagingId, userId, at(30_000))).not.toBeNull();
  });

  it("is fenced: a release from an overrun claim cannot end the newer claim's lease", async () => {
    const userId = uid();
    const started = await stage(userId, await jpegWithExif());
    const a = await claimStaging(started.stagingId, userId, NOW);
    const b = await claimStaging(started.stagingId, userId, at(31_000));
    await releaseStaging(started.stagingId, userId, a!.claimedUntil!);
    // B still holds the slot: a third claim just after is refused.
    expect(await claimStaging(started.stagingId, userId, at(31_001))).toBeNull();
    await releaseStaging(started.stagingId, userId, b!.claimedUntil!);
    expect(await claimStaging(started.stagingId, userId, at(31_002))).not.toBeNull();
  });

  it("is fenced: a refusal from an overrun claim cannot consume the newer claim's slot", async () => {
    const userId = uid();
    const started = await stage(userId, await jpegWithExif());
    const a = await claimStaging(started.stagingId, userId, NOW);
    const b = await claimStaging(started.stagingId, userId, at(31_000));
    await consumeStaging(started.stagingId, userId, a!.claimedUntil!);
    expect(await peekStaging(started.stagingId, userId, at(31_000))).not.toBeNull();
    await consumeStaging(started.stagingId, userId, b!.claimedUntil!);
    expect(await peekStaging(started.stagingId, userId, at(31_000))).toBeNull();
  });

  it("an overrun finish loses cleanly: one record, its own final file deleted, the winner's kept", async () => {
    const userId = uid();
    let open!: () => void;
    let parked!: () => void;
    const gate = new Promise<void>((resolve) => (open = resolve));
    const inPut = new Promise<void>((resolve) => (parked = resolve));
    const store = getDeps().files;
    let first = true;
    const { finals } = trackFiles({
      put: async (p, b, t) => {
        // The first final put (call A) waits until call B has finished.
        if (p.startsWith("rx/") && first) {
          first = false;
          parked();
          await gate;
        }
        await store.put(p, b, t);
      },
    });
    const started = await stage(userId, await jpegWithExif());
    const a = finish(userId, started.stagingId, NOW);
    // Wait until A is parked in its put, then let its lease lapse and run B to completion.
    await inPut;
    expect((await finish(userId, started.stagingId, at(31_000))).ok).toBe(true);
    open();
    expect(await a).toEqual({ ok: false, error: "upload_expired" });

    const records = await listRxForUser(userId);
    expect(records).toHaveLength(1);
    expect(await count(AUDIT)).toBe(1);
    for (const k of finals())
      expect((await store.get(k)) !== null).toBe(k === records[0]!.file.key);
  });
});

describe("an unknown commit result", () => {
  it("retries a labelled error through the driver's commit loop and records once", async () => {
    const userId = uid();
    const started = await stage(userId, await jpegWithExif());
    const real = ClientSession.prototype.commitTransaction;
    let calls = 0;
    vi.spyOn(ClientSession.prototype, "commitTransaction").mockImplementation(async function (
      this: InstanceType<typeof ClientSession>,
    ) {
      await real.call(this);
      if (++calls === 1) {
        const e = new MongoServerError({ message: "no majority in time", code: 1 });
        e.addErrorLabel("UnknownTransactionCommitResult");
        throw e;
      }
    });
    expect((await finish(userId, started.stagingId)).ok).toBe(true);
    expect(calls).toBe(2);
    expect(await listRxForUser(userId)).toHaveLength(1);
    expect(await count(AUDIT)).toBe(1);
  });
});
