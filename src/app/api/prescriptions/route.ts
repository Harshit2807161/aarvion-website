import { connection } from "next/server";
import { requireUser, sessionRefreshHeaders } from "@/server/auth/guards";
import { getDeps } from "@/server/deps";
import { jsonResponse, readJson, withErrors } from "@/server/http";
import {
  listRxForUser,
  RX_CLAIM_LEASE_MS,
  RxCreateBody,
} from "@/server/prescriptions/prescriptions";
import { rxView } from "@/server/prescriptions/review";
import { finishRxUpload, isUnknownCommit } from "@/server/prescriptions/upload";
import { assertSameOrigin } from "@/server/security/origin";

/**
 * Finalising decodes and re-encodes an image (5 s cap) or scans a PDF (1 s cap, queued) and writes
 * the result to Blob, so allow more than the platform default. Memory is a project setting under
 * Fluid compute (docs/dev/deploy.md).
 */
export const maxDuration = 60;

/** `busy` (the PDF check queue is full, or another finish holds the slot) clears in seconds. */
const BUSY_RETRY_AFTER_SEC = 5;

/** `GET /api/prescriptions`: the caller's prescriptions, newest first (at most 50). */
export const GET = withErrors(async (req) => {
  await connection();
  const auth = await requireUser(req);
  const now = getDeps().now();
  const items = (await listRxForUser(auth.user._id)).map((doc) => rxView(doc, now));
  return jsonResponse({ items }, { headers: sessionRefreshHeaders(auth) });
});

/**
 * `POST /api/prescriptions { stagingId, patientName, declaration: true }`: validates the staged
 * file and records the prescription. 201 `{ rx }`; 200 `{ rx }` when this slot was already
 * finalised (idempotent by `stagingId`: the record it made, nothing new); 410 `upload_expired` (slot
 * gone, refused or another user's, with no record of the caller's); 422
 * `{ error: "invalid_file", reason }`; 503 `busy` with `Retry-After` (retryable, never a 4xx);
 * 500 `upload_unconfirmed` with `Retry-After` when the database could not confirm the commit (the
 * record may exist: a retry with the same `stagingId` returns it with 200, or 410 if it never
 * committed). Only ids are ever logged.
 */
export const POST = withErrors(async (req) => {
  assertSameOrigin(req);
  const auth = await requireUser(req);
  const body = await readJson(req, RxCreateBody);
  const headers = sessionRefreshHeaders(auth);
  let result;
  try {
    // A fresh clock per request: the slot lease and its fence compare against this instant.
    const now = getDeps().now();
    result = await finishRxUpload({ userId: auth.user._id, role: auth.user.role, body, now });
  } catch (e) {
    if (!isUnknownCommit(e)) throw e;
    // The error name only (no ids, no Rx content); the database and audit carry the user.
    console.error("rx finalise commit unknown", e instanceof Error ? e.name : "error");
    const retryAfterSec = RX_CLAIM_LEASE_MS / 1000;
    headers.set("Retry-After", String(retryAfterSec));
    return jsonResponse(
      { error: "upload_unconfirmed", retryable: true, retryAfterSec },
      { status: 500, headers },
    );
  }
  // A replay (the slot was finalised before, e.g. the first response was lost) is 200, same body.
  if (result.ok) {
    return jsonResponse({ rx: result.rx }, { status: result.replay ? 200 : 201, headers });
  }
  if (result.error === "upload_expired") {
    return jsonResponse({ error: "upload_expired" }, { status: 410, headers });
  }
  if (result.error === "busy") {
    headers.set("Retry-After", String(BUSY_RETRY_AFTER_SEC));
    return jsonResponse(
      { error: "busy", retryAfterSec: BUSY_RETRY_AFTER_SEC },
      { status: 503, headers },
    );
  }
  return jsonResponse({ error: "invalid_file", reason: result.error }, { status: 422, headers });
});
