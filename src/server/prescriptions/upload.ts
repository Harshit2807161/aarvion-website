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
  createStaging,
  insertRx,
  peekStaging,
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
  | { ok: true; rx: RxListItem }
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

/** The commit's outcome is unknown (no majority in time, or the commit timed out), not a clean abort. */
function isUnknownCommit(e: unknown): boolean {
  return (
    e instanceof MongoError &&
    (e.hasErrorLabel("UnknownTransactionCommitResult") ||
      e.code === 50 ||
      e.name === "MongoWriteConcernError")
  );
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
 * Finalise an upload. The slot is only peeked until the end: the file is read, checked and stored
 * first, then one transaction takes the slot, inserts the record and appends its `rx.upload`
 * audit row, so the record and its audit exist together or not at all, and an aborted transaction
 * leaves the slot free for a retry. If a concurrent finish took the slot first this call's final
 * file is deleted and the result is `upload_expired`. The staged file is deleted afterwards on a
 * best-effort basis; anything left is swept by prefix and age (phase N).
 */
export async function finishRxUpload(i: {
  userId: ObjectId;
  role: Role;
  body: RxCreateBody;
  now: Date;
}): Promise<FinishResult> {
  const body = RxCreateBody.parse(i.body);
  const { files } = getDeps();
  const slot = await peekStaging(body.stagingId, i.userId, i.now);
  if (!slot) return { ok: false, error: "upload_expired" };

  let staged: { body: Uint8Array } | null;
  try {
    staged = await files.get(slot.key, { maxBytes: RX_MAX_BYTES });
  } catch (e) {
    if (!(e instanceof FileTooLargeError)) throw e;
    await dropQuietly(slot.key);
    return { ok: false, error: "too_large" };
  }
  if (!staged) return { ok: false, error: "file_missing" };

  const checked = await checkRxFile(staged.body);
  if (!checked.ok) {
    // `busy` (the PDF scanner is full) is retryable: keep the staged file and the live slot.
    if (checked.error !== "busy") await dropQuietly(slot.key);
    return checked;
  }
  const file = checked.file;

  const _id = new ObjectId();
  const key = `rx/${i.userId.toHexString()}/${_id.toHexString()}.${file.ext}`;
  await putFinal(key, file);
  const doc: RxDoc = {
    _id,
    userId: i.userId,
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
      if (!(await takeStaging(body.stagingId, i.userId, i.now, session))) return;
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
    // An unknown commit result may have applied. Fail closed: never delete the file of a record
    // that may exist; the error is rethrown and phase N sweeps an orphan by age.
    if (!(callbackDone && isUnknownCommit(e))) await dropQuietly(key);
    throw e;
  } finally {
    await session.endSession();
  }
  if (!taken) {
    // A concurrent finish took the slot first and owns the staged file.
    await dropQuietly(key);
    return { ok: false, error: "upload_expired" };
  }
  await dropQuietly(slot.key);
  return { ok: true, rx: rxView(doc, i.now) };
}
