import { createHash } from "node:crypto";
import { MongoError, ObjectId } from "mongodb";
import type { Role } from "../auth/roles.ts";
import { appendAudit } from "../audit.ts";
import { getMongoClient } from "../db/client.ts";
import { getDeps } from "../deps.ts";
import { FileExistsError, FileTooLargeError } from "../providers/file-keys.ts";
import { hitRateLimit } from "../security/rate-limit.ts";
import { checkRxFile, RX_MAX_BYTES, type CheckedRxFile, type RxFileError } from "./file-check.ts";
import {
  claimStaging,
  consumeStaging,
  createStaging,
  getRxByStaging,
  getRxForUser,
  insertRx,
  peekStaging,
  releaseStaging,
  RxCreateBody,
  RX_UPLOAD_LIMITS,
  takeStaging,
  type RxDoc,
} from "./prescriptions.ts";
import { RX_DECLARATION_VERSION, rxView, type RxListItem } from "./review.ts";

/**
 * The upload service: a slot is issued (`startRxUpload`), the bytes are put at its key by the
 * browser (Blob client upload or our own handler, R5), and `finishRxUpload` validates them,
 * stores the private file and inserts the record. Single use, ownership in every filter. Logs
 * nothing: the patient name, bytes and file names never leave a return value or the database.
 */

export type StartResult =
  | { ok: true; stagingId: string; key: string; mode: "client-token" | "direct" }
  | { ok: false; error: "rate_limited"; retryAfterSec: number };

/** Issues a staging slot. The IP limit is checked first, so a blocked IP spends no user budget. */
export async function startRxUpload(i: {
  userId: ObjectId;
  ipBucket: string;
  now: Date;
}): Promise<StartResult> {
  const ip = await hitRateLimit({
    key: `rx-upload:ip:${i.ipBucket}`,
    ...RX_UPLOAD_LIMITS.ip,
    now: i.now,
  });
  if (!ip.allowed) return { ok: false, error: "rate_limited", retryAfterSec: ip.retryAfterSec };
  const user = await hitRateLimit({
    key: `rx-upload:user:${i.userId.toHexString()}`,
    ...RX_UPLOAD_LIMITS.user,
    now: i.now,
  });
  if (!user.allowed) return { ok: false, error: "rate_limited", retryAfterSec: user.retryAfterSec };
  const slot = await createStaging(i.userId, i.now);
  const mode = getDeps().files.kind === "blob" ? "client-token" : "direct";
  return { ok: true, stagingId: slot._id, key: slot.key, mode };
}

export type FinishResult =
  /** `replay`: the slot was already finalised; `rx` is the record it made then (nothing new written). */
  | { ok: true; rx: RxListItem; replay?: true }
  | { ok: false; error: "upload_expired" | "file_missing" | RxFileError };

const sha256 = (b: Uint8Array) => createHash("sha256").update(b).digest("hex");

/**
 * Put the final file. The Blob SDK retries internally, so a put whose first attempt landed comes
 * back as FileExistsError: that is success only if the stored bytes hash to ours (ids are fresh,
 * so any other existing file is a real conflict and is rethrown).
 */
async function putFinal(path: string, file: CheckedRxFile): Promise<void> {
  const { files } = getDeps();
  try {
    await files.put(path, file.body, file.contentType);
  } catch (e) {
    if (!(e instanceof FileExistsError)) throw e;
    const existing = await files.get(path, { maxBytes: RX_MAX_BYTES });
    if (!existing || sha256(existing.body) !== file.sha256) throw e;
  }
}

/** Atomicity must not depend on the cluster default: majority writes, majority reads. */
const TRANSACTION_OPTIONS = {
  writeConcern: { w: "majority" },
  readConcern: { level: "majority" },
} as const;

/**
 * The commit's outcome is unknown (no majority in time, or the commit timed out), not a clean
 * abort. Exported for the finalise route, which answers it with a retryable 500.
 */
export function isUnknownCommit(e: unknown): boolean {
  return (
    e instanceof MongoError &&
    (e.hasErrorLabel("UnknownTransactionCommitResult") ||
      e.code === 50 ||
      e.name === "MongoWriteConcernError")
  );
}

/** A duplicate key on `stagingId_unique`: another finish already recorded this slot. */
function isDuplicateSlot(e: unknown): boolean {
  if (!(e instanceof MongoError) || e.code !== 11000) return false;
  // The key pattern, not the message text, says which unique index refused the insert.
  const pattern = (e as MongoError & { keyPattern?: Record<string, unknown> }).keyPattern;
  return pattern !== undefined && Object.hasOwn(pattern, "stagingId");
}

/**
 * The record an earlier finish of this slot made, as a replay; else `upload_expired`. A slot that
 * is another user's, refused, expired or never finalised has no record and stays `upload_expired`.
 */
async function replayOrExpired(
  stagingId: string,
  userId: ObjectId,
  now: Date,
): Promise<FinishResult> {
  const done = await getRxByStaging(stagingId, userId);
  return done
    ? { ok: true, rx: rxView(done, now), replay: true }
    : { ok: false, error: "upload_expired" };
}

/** Best-effort cleanup: a failed delete never decides the outcome, and only an error name is logged. */
async function dropQuietly(path: string): Promise<void> {
  try {
    await getDeps().files.delete(path);
  } catch (e) {
    console.error("rx file cleanup failed", e instanceof Error ? e.name : "error");
  }
}

/**
 * Finalise an upload. The slot is leased to this call (`claimStaging`), so the expensive work runs
 * once at a time per slot: a concurrent or repeat finish gets a retryable `busy`. The file is
 * then read, checked and stored, and one transaction takes the slot, inserts the record and
 * appends its `rx.upload` audit row, so they exist together or not at all. A refusal consumes
 * the slot; `busy` (the PDF scanner is full) and an abort release the lease, so a retry works. If
 * the commit's outcome is unknown the file is kept (the record may exist) and the error is
 * rethrown: phase N sweeps `rx/` orphans by age. The staged file is deleted afterwards best-effort.
 *
 * Idempotent by slot (ruling R6-I1): the record stores its `stagingId` (unique), so a finish of a
 * slot that is already used returns the record that slot made (`replay`), for example after the
 * first response was lost or its commit result was unknown. Only the owner's record is returned.
 */
export async function finishRxUpload(i: {
  userId: ObjectId;
  role: Role;
  body: RxCreateBody;
  now: Date;
}): Promise<FinishResult> {
  const body = RxCreateBody.parse(i.body);
  const { files } = getDeps();
  const slot = await claimStaging(body.stagingId, i.userId, i.now);
  if (!slot) {
    const live = await peekStaging(body.stagingId, i.userId, i.now);
    return live ? { ok: false, error: "busy" } : replayOrExpired(body.stagingId, i.userId, i.now);
  }
  const release = () => releaseStaging(body.stagingId, i.userId, slot.claimedUntil!);
  const refuse = async (
    error: "too_large" | "file_missing" | RxFileError,
  ): Promise<FinishResult> => {
    await dropQuietly(slot.key);
    await consumeStaging(body.stagingId, i.userId, slot.claimedUntil!);
    return { ok: false, error };
  };

  let staged: { body: Uint8Array } | null;
  try {
    staged = await files.get(slot.key, { maxBytes: RX_MAX_BYTES });
  } catch (e) {
    if (!(e instanceof FileTooLargeError)) {
      await release();
      throw e;
    }
    return refuse("too_large");
  }
  if (!staged) return refuse("file_missing");

  const checked = await checkRxFile(staged.body);
  if (!checked.ok) {
    if (checked.error !== "busy") return refuse(checked.error);
    await release();
    return checked;
  }
  const file = checked.file;

  const _id = new ObjectId();
  const key = `rx/${i.userId.toHexString()}/${_id.toHexString()}.${file.ext}`;
  try {
    await putFinal(key, file);
  } catch (e) {
    await release();
    throw e;
  }
  const doc: RxDoc = {
    _id,
    userId: i.userId,
    stagingId: body.stagingId,
    patientName: body.patientName,
    declaration: { version: RX_DECLARATION_VERSION, at: i.now },
    file: {
      key,
      contentType: file.contentType,
      kind: file.kind,
      pages: file.pages,
      bytes: file.body.length,
      sha256: file.sha256,
    },
    status: "pending",
    review: null,
    rxDate: null,
    validUntil: null,
    createdAt: i.now,
    updatedAt: i.now,
  };

  const session = (await getMongoClient()).startSession();
  let taken = false;
  let callbackDone = false;
  try {
    await session.withTransaction(async () => {
      // withTransaction may run this again after a transient error: start from a clean state.
      taken = false;
      callbackDone = false;
      if (!(await takeStaging(body.stagingId, i.userId, i.now, session))) {
        callbackDone = true;
        return;
      }
      taken = true;
      await insertRx(doc, session);
      await appendAudit(
        {
          at: i.now,
          action: "rx.upload",
          actor: { type: "user", userId: i.userId, role: i.role },
          target: { type: "prescription", id: _id.toHexString() },
          meta: { kind: file.kind, pages: file.pages },
        },
        session,
      );
      callbackDone = true;
    }, TRANSACTION_OPTIONS);
  } catch (e) {
    if (callbackDone && isUnknownCommit(e)) {
      // The commit's outcome is unknown. Fail closed: never delete the file of a record that may
      // exist. The lookup reads with the default concern on purpose: a majority read would hide a
      // commit that is applied but not yet replicated and report the opposite of the truth.
      const found = await getRxForUser(_id, i.userId).catch(() => null);
      if (!found) throw e;
      taken = true;
    } else {
      await dropQuietly(key);
      if (isDuplicateSlot(e)) {
        // The slot already has its record: consume the slot, so a later finish replays at once
        // instead of re-checking and re-putting the file.
        await consumeStaging(body.stagingId, i.userId, slot.claimedUntil!).catch(() => {});
        return replayOrExpired(body.stagingId, i.userId, i.now);
      }
      await release().catch(() => {});
      throw e;
    }
  } finally {
    await session.endSession();
  }
  if (!taken) {
    // The slot was gone (its lease ended and another finish completed): that call owns the staged
    // file, and its record, if it made one, is this slot's answer.
    await dropQuietly(key);
    return replayOrExpired(body.stagingId, i.userId, i.now);
  }
  await dropQuietly(slot.key);
  return { ok: true, rx: rxView(doc, i.now) };
}
