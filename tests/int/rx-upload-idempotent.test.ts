import { ClientSession, Collection, MongoServerError, ObjectId } from "mongodb";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getDb } from "@/server/db/client";
import { ensureIndexes } from "@/server/db/indexes";
import { getDeps } from "@/server/deps";
import {
  insertRx,
  listRxForUser,
  PRESCRIPTIONS_COLLECTION,
  type RxDoc,
} from "@/server/prescriptions/prescriptions";
import { jpegWithExif } from "../helpers/rx-fixtures";
import {
  AUDIT,
  finish,
  NOW,
  PATIENT,
  setupRxUploadHarness,
  stage,
  trackFiles,
  uid,
} from "../helpers/rx-upload";

/**
 * Ruling R6-I1: finalise is idempotent by staging slot. The record stores its `stagingId` behind
 * the partial unique index `stagingId_unique`, and a finish of a used slot returns the record that
 * slot made (`replay`) to its owner only; a used slot with no record, or another user's, is 410.
 */
setupRxUploadHarness();
afterEach(() => vi.restoreAllMocks());

const count = async (c: string, q = {}) => (await getDb()).collection(c).countDocuments(q);

/** The commit applies, then reports an unknown result, and the read-back fails: a lost answer. */
function loseTheAnswer() {
  const commit = ClientSession.prototype.commitTransaction;
  vi.spyOn(ClientSession.prototype, "commitTransaction").mockImplementationOnce(async function (
    this: InstanceType<typeof ClientSession>,
  ) {
    await commit.call(this);
    throw new MongoServerError({ message: "commit timed out", code: 50 });
  });
  const findOne = Collection.prototype.findOne;
  vi.spyOn(Collection.prototype, "findOne").mockImplementationOnce(function (
    this: InstanceType<typeof Collection>,
    ...args: Parameters<typeof findOne>
  ) {
    if (this.collectionName === PRESCRIPTIONS_COLLECTION) {
      return Promise.reject(new Error("read down"));
    }
    return findOne.apply(this, args);
  } as typeof findOne);
}

describe("finalise is idempotent by staging slot", () => {
  it("stores the slot on the record", async () => {
    const userId = uid();
    const started = await stage(userId, await jpegWithExif());
    expect((await finish(userId, started.stagingId)).ok).toBe(true);
    expect((await listRxForUser(userId))[0]).toMatchObject({ stagingId: started.stagingId });
  });

  it("a resume after a lost answer returns the same record, and writes nothing new", async () => {
    const userId = uid();
    const started = await stage(userId, await jpegWithExif());
    loseTheAnswer();
    await expect(finish(userId, started.stagingId)).rejects.toThrow("commit timed out");
    vi.restoreAllMocks();
    const [record] = await listRxForUser(userId);
    expect(record).toBeDefined();

    const later = new Date(NOW.getTime() + 60_000);
    const resumed = await finish(userId, started.stagingId, later);
    expect(resumed).toMatchObject({ ok: true, replay: true, rx: { patientName: PATIENT } });
    expect(resumed.ok && resumed.rx.id).toBe(record!._id.toHexString());
    expect(await count(PRESCRIPTIONS_COLLECTION)).toBe(1);
    expect(await count(AUDIT, { action: "rx.upload" })).toBe(1);
    // The record's file is untouched.
    expect(await getDeps().files.get(record!.file.key)).not.toBeNull();
  });

  it("a resume long after the slot expired still returns its record", async () => {
    const userId = uid();
    const started = await stage(userId, await jpegWithExif());
    const first = await finish(userId, started.stagingId);
    const nextDay = new Date(NOW.getTime() + 86_400_000);
    const again = await finish(userId, started.stagingId, nextDay);
    expect(again).toMatchObject({ ok: true, replay: true });
    expect(again.ok && first.ok && again.rx.id).toBe(first.ok && first.rx.id);
  });

  it("never returns another user's record for their slot: 410, as for any miss", async () => {
    const owner = uid();
    const other = uid();
    const started = await stage(owner, await jpegWithExif());
    expect((await finish(owner, started.stagingId)).ok).toBe(true);
    expect(await finish(other, started.stagingId)).toEqual({ ok: false, error: "upload_expired" });
    expect(await count(PRESCRIPTIONS_COLLECTION)).toBe(1);
  });

  it("a used slot with no record (a refused file) stays 410", async () => {
    const userId = uid();
    const started = await stage(userId, new Uint8Array([1, 2, 3]));
    expect(await finish(userId, started.stagingId)).toEqual({
      ok: false,
      error: "unsupported_type",
    });
    expect(await finish(userId, started.stagingId)).toEqual({
      ok: false,
      error: "upload_expired",
    });
  });

  it("a double finalise creates one record: the second gets busy, then the same record", async () => {
    const userId = uid();
    const started = await stage(userId, await jpegWithExif());
    const [a, b] = await Promise.all([
      finish(userId, started.stagingId),
      finish(userId, started.stagingId),
    ]);
    const results = [a, b];
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.filter((r) => !r.ok)).toEqual([{ ok: false, error: "busy" }]);
    const winner = results.find((r) => r.ok)!;
    const again = await finish(userId, started.stagingId);
    expect(again.ok && winner.ok && again.rx.id).toBe(winner.ok && winner.rx.id);
    expect(await count(PRESCRIPTIONS_COLLECTION)).toBe(1);
    expect(await count(AUDIT, { action: "rx.upload" })).toBe(1);
  });

  it("the unique index refuses a second record for one slot, and finish answers with the first", async () => {
    await ensureIndexes(await getDb());
    const userId = uid();
    const { finals, store } = trackFiles();
    const started = await stage(userId, await jpegWithExif());
    // A record for this slot already exists while the slot is still live (as if a commit landed
    // that the slot's delete did not reach): the insert hits stagingId_unique.
    const existing: RxDoc = {
      _id: new ObjectId(),
      userId,
      stagingId: started.stagingId,
      patientName: PATIENT,
      declaration: { version: "2026-11-27", at: NOW },
      file: {
        key: `rx/${userId.toHexString()}/existing.webp`,
        contentType: "image/webp",
        kind: "image",
        pages: 1,
        bytes: 1,
        sha256: "0".repeat(64),
      },
      status: "pending",
      review: null,
      rxDate: null,
      validUntil: null,
      createdAt: NOW,
      updatedAt: NOW,
    };
    await insertRx(existing);
    await expect(insertRx({ ...existing, _id: new ObjectId() })).rejects.toMatchObject({
      code: 11000,
    });
    const r = await finish(userId, started.stagingId);
    expect(r).toMatchObject({ ok: true, replay: true });
    expect(r.ok && r.rx.id).toBe(existing._id.toHexString());
    expect(await count(PRESCRIPTIONS_COLLECTION)).toBe(1);
    // This call's own final file was dropped.
    for (const k of finals()) expect(await store.get(k)).toBeNull();
  });
});
