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
 * file and records the prescription. 201 `{ rx }`; 410 `upload_expired` (slot gone or used); 422
 * `{ error: "invalid_file", reason }`; 503 `busy` with `Retry-After` (retryable, never a 4xx);
 * 500 `upload_unconfirmed` with `Retry-After` when the database could not confirm the commit (the
 * record may exist: the client re-reads the list before retrying). Only ids are ever logged.
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
    console.error("rx finalise commit unknown", auth.user._id.toHexString());
    headers.set("Retry-After", String(RX_CLAIM_LEASE_MS / 1000));
    return jsonResponse({ error: "upload_unconfirmed", retryable: true }, { status: 500, headers });
  }
  if (result.ok) return jsonResponse({ rx: result.rx }, { status: 201, headers });
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
