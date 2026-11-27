import { createHash } from "node:crypto";
import { ObjectId } from "mongodb";
import { appendAudit } from "../audit.ts";
import { getDeps } from "../deps.ts";
import { FileExistsError, FileTooLargeError } from "../providers/file-keys.ts";
import { hitRateLimit } from "../security/rate-limit.ts";
import { checkRxFile, RX_MAX_BYTES, type CheckedRxFile, type RxFileError } from "./file-check.ts";
import {
  createStaging,
  insertRx,
  RX_UPLOAD_LIMITS,
  takeStaging,
  type RxCreateBody,
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

export async function finishRxUpload(i: {
  userId: ObjectId;
  body: RxCreateBody;
  now: Date;
}): Promise<FinishResult> {
  const { files } = getDeps();
  const slot = await takeStaging(i.body.stagingId, i.userId, i.now);
  if (!slot) return { ok: false, error: "upload_expired" };

  let staged: { body: Uint8Array } | null;
  try {
    staged = await files.get(slot.key, { maxBytes: RX_MAX_BYTES });
  } catch (e) {
    if (!(e instanceof FileTooLargeError)) throw e;
    await files.delete(slot.key);
    return { ok: false, error: "too_large" };
  }
  if (!staged) return { ok: false, error: "file_missing" };

  const checked = await checkRxFile(staged.body);
  if (!checked.ok) {
    await files.delete(slot.key);
    return checked;
  }
  const file = checked.file;

  const _id = new ObjectId();
  const key = `rx/${i.userId.toHexString()}/${_id.toHexString()}.${file.ext}`;
  await putFinal(key, file);
  const doc: RxDoc = {
    _id,
    userId: i.userId,
    patientName: i.body.patientName,
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
  try {
    await insertRx(doc);
  } catch (e) {
    await files.delete(key);
    throw e;
  }
  await files.delete(slot.key);
  try {
    await appendAudit({
      at: i.now,
      action: "rx.upload",
      actor: { type: "user", userId: i.userId, role: "customer" },
      target: { type: "prescription", id: _id.toHexString() },
      meta: { kind: file.kind, pages: file.pages },
    });
  } catch (e) {
    // The record is stored; an audit outage must not make the customer upload it twice.
    console.error("rx upload audit failed", e instanceof Error ? e.name : "error");
  }
  return { ok: true, rx: rxView(doc, i.now) };
}
