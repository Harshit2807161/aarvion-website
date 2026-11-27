import type { ObjectId } from "mongodb";
import { getDeps } from "../deps.ts";
import { hitRateLimit } from "../security/rate-limit.ts";
import { createStaging, RX_UPLOAD_LIMITS } from "./prescriptions.ts";

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
