/**
 * Browser client for the prescription routes (R5; shapes in docs/dev/architecture.md). It talks
 * to the HTTP contracts only and imports src/server/** for types alone. No function throws: a
 * transport failure, a timeout, an abort, a non-JSON body or an unexpected status all become a
 * safe `ok: false` result (`network`). Nothing here logs: names and file bytes are personal data.
 *
 * An upload is three steps: a staging slot, the bytes (by the slot's `mode`), then finalise.
 * Retries are bounded and only where they are safe:
 * - a PUT that failed in transit is sent once more (the same bytes are idempotent, 204);
 * - a PUT 409 (the slot holds other bytes) starts one fresh slot;
 * - a 503 `busy` finalise waits `Retry-After` and tries again, up to RX_BUSY_RETRIES times;
 * - a 500 `upload_unconfirmed`, or a finalise lost in transit after the bytes were sent, is never
 *   retried here: the record may exist. The result hands back the `stagingId`, and a later
 *   `uploadRx` with it finalises that same slot. Finalise is idempotent by slot (#244): a slot
 *   that was already finalised answers 200 with its record, so the resume is exact. A 410 on a
 *   resume means the slot is gone with no record of ours, and is never reported as sent
 *   (`upload_unknown`: the shopper checks their prescriptions).
 */
import type { RxFileError } from "@/server/prescriptions/file-check";
import type { RxListItem } from "@/server/prescriptions/review";

export type { RxListItem };

export type RxUploadError =
  | "unauthenticated"
  | "rate_limited"
  | "upload_expired"
  | "upload_unconfirmed"
  /** A resumed finalise found the slot gone with no record of ours: never a success. */
  | "upload_unknown"
  | "invalid_request"
  | "network"
  | RxFileError
  | "file_missing";

export type RxUploadResult =
  | { ok: true; rx: RxListItem }
  | { ok: false; error: RxUploadError; retryAfterSec?: number; stagingId?: string };

export const RX_BUSY_RETRIES = 3;
/** A busy wait the server names is honoured up to this; a missing one is BUSY_DEFAULT_SEC. */
const BUSY_MAX_WAIT_SEC = 15;
const BUSY_DEFAULT_SEC = 5;

/** The bytes may be 8 MB on a phone; finalising may take the route's whole 60 s. */
const PUT_TIMEOUT_MS = 120_000;
const FINALISE_TIMEOUT_MS = 70_000;
const SHORT_TIMEOUT_MS = 15_000;
const BLOB_TOKEN_URL = "/api/prescriptions/blob-token";
const STAGING_ID = /^[A-Za-z0-9_-]{22}$/;
const FILE_ERRORS: readonly (RxFileError | "file_missing")[] = [
  "empty",
  "too_large",
  "unsupported_type",
  "corrupt",
  "too_small",
  "animated",
  "too_many_pages",
  "encrypted",
  "active_content",
  "busy",
  "file_missing",
];

type Json = Record<string, unknown>;
type Reply = { status: number; body: Json | null; headers: Headers } | null;
type Fail = Extract<RxUploadResult, { ok: false }>;

/** Sends the request with a timeout tied to the caller's signal; null on any transport failure. */
async function request(
  path: string,
  init: RequestInit,
  timeoutMs: number,
  signal?: AbortSignal,
): Promise<Reply> {
  if (signal?.aborted) return null;
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  const onAbort = () => ctl.abort();
  signal?.addEventListener("abort", onAbort, { once: true });
  try {
    const res = await fetch(path, {
      credentials: "same-origin",
      cache: "no-store",
      ...init,
      signal: ctl.signal,
    });
    let body: Json | null = null;
    try {
      const parsed: unknown = await res.json();
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) body = parsed as Json;
    } catch {
      body = null;
    }
    return { status: res.status, body, headers: res.headers };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onAbort);
  }
}

function retryAfter(r: NonNullable<Reply>): number | undefined {
  const v = r.body?.retryAfterSec ?? Number(r.headers.get("Retry-After") ?? NaN);
  return typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : undefined;
}

/** The answers every route shares: 401, 429, and anything unexpected. */
function common(r: Reply): Fail {
  if (r?.status === 401) return { ok: false, error: "unauthenticated" };
  if (r?.status === 429) {
    const wait = retryAfter(r);
    return {
      ok: false,
      error: "rate_limited",
      ...(wait === undefined ? {} : { retryAfterSec: wait }),
    };
  }
  return { ok: false, error: "network" };
}

/** Waits `sec` seconds; false if the caller aborted meanwhile. */
function wait(sec: number, signal?: AbortSignal): Promise<boolean> {
  return new Promise((resolve) => {
    if (signal?.aborted) return resolve(false);
    const done = (ok: boolean) => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
      resolve(ok);
    };
    const onAbort = () => done(false);
    const timer = setTimeout(() => done(true), sec * 1000);
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

type Slot = { stagingId: string; mode: "direct" | "client-token"; pathname: string };

async function stage(signal?: AbortSignal): Promise<{ ok: true; slot: Slot } | Fail> {
  const r = await request(
    "/api/prescriptions/staging",
    { method: "POST" },
    SHORT_TIMEOUT_MS,
    signal,
  );
  const b = r?.body;
  if (r?.status !== 201 || !b) return common(r);
  const { stagingId, mode, pathname } = b;
  if (
    typeof stagingId !== "string" ||
    !STAGING_ID.test(stagingId) ||
    (mode !== "direct" && mode !== "client-token") ||
    typeof pathname !== "string"
  ) {
    return { ok: false, error: "network" };
  }
  return { ok: true, slot: { stagingId, mode, pathname } };
}

/** "conflict" is a PUT 409: this slot already holds different bytes. */
async function sendDirect(
  slot: Slot,
  blob: Blob,
  signal?: AbortSignal,
): Promise<"ok" | "conflict" | Fail> {
  const put = () =>
    request(
      `/api/prescriptions/staging/${slot.stagingId}`,
      {
        method: "PUT",
        headers: { "Content-Type": blob.type || "application/octet-stream" },
        body: blob,
      },
      PUT_TIMEOUT_MS,
      signal,
    );
  const r = (await put()) ?? (signal?.aborted ? null : await put());
  if (r?.status === 204) return "ok";
  if (r?.status === 409) return "conflict";
  if (r?.status === 404) return { ok: false, error: "upload_expired" };
  if (r?.status === 413) return { ok: false, error: "too_large" };
  if (r?.status === 400) return { ok: false, error: "empty" };
  return common(r);
}

/** Uploads to Blob with a token pinned to this slot; the SDK loads only on this path. */
async function sendToBlob(slot: Slot, blob: Blob, signal?: AbortSignal): Promise<"ok" | Fail> {
  try {
    const { upload } = await import("@vercel/blob/client");
    await upload(slot.pathname, blob, {
      access: "private",
      handleUploadUrl: BLOB_TOKEN_URL,
      clientPayload: slot.stagingId,
      // The pathname has no extension, so the type must be named for the token's allow-list.
      contentType: blob.type || undefined,
      abortSignal: signal,
    });
    return "ok";
  } catch (e) {
    // `allowOverwrite: false`: a retry of an upload that already landed. Treat it as uploaded.
    if (e instanceof Error && /already exists/i.test(e.message)) return "ok";
    return { ok: false, error: "network" };
  }
}

/** One slot and its bytes; "conflict" when a direct slot already holds other bytes. */
async function sendOnce(
  blob: Blob,
  signal?: AbortSignal,
): Promise<{ ok: true; stagingId: string } | "conflict" | Fail> {
  const staged = await stage(signal);
  if (!staged.ok) return staged;
  const { slot } = staged;
  const sent =
    slot.mode === "direct"
      ? await sendDirect(slot, blob, signal)
      : await sendToBlob(slot, blob, signal);
  return sent === "ok" ? { ok: true, stagingId: slot.stagingId } : sent;
}

/** A PUT 409 means the slot is not ours to fill: start one fresh slot, once. */
async function stageAndSend(
  blob: Blob,
  signal?: AbortSignal,
): Promise<{ ok: true; stagingId: string } | Fail> {
  const first = await sendOnce(blob, signal);
  if (first !== "conflict") return first;
  const second = await sendOnce(blob, signal);
  return second === "conflict" ? { ok: false, error: "network" } : second;
}

async function finaliseOnce(
  stagingId: string,
  patientName: string,
  signal?: AbortSignal,
): Promise<RxUploadResult> {
  const r = await request(
    "/api/prescriptions",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stagingId, patientName, declaration: true }),
    },
    FINALISE_TIMEOUT_MS,
    signal,
  );
  // 201: recorded now. 200: this slot was already finalised (#244); the body is its record.
  if (r?.status === 201 || r?.status === 200) {
    const rx = r.body?.rx;
    return rx && typeof rx === "object"
      ? { ok: true, rx: rx as RxListItem }
      : { ok: false, error: "network" };
  }
  if (r?.status === 503 && r.body?.error === "busy") {
    return { ok: false, error: "busy", retryAfterSec: retryAfter(r) ?? 5 };
  }
  if (r?.status === 500 && r.body?.error === "upload_unconfirmed") {
    return {
      ok: false,
      error: "upload_unconfirmed",
      retryAfterSec: retryAfter(r) ?? 30,
    };
  }
  if (r?.status === 410) return { ok: false, error: "upload_expired" };
  if (r?.status === 400) return { ok: false, error: "invalid_request" };
  if (r?.status === 422) {
    const known = FILE_ERRORS.find((e) => e === r.body?.reason);
    return { ok: false, error: known ?? "corrupt" };
  }
  return common(r);
}

/** Finalises, waiting out a `busy` check queue up to RX_BUSY_RETRIES times. */
async function finalise(
  stagingId: string,
  patientName: string,
  signal?: AbortSignal,
): Promise<RxUploadResult> {
  for (let tries = 0; ; tries++) {
    const done = await finaliseOnce(stagingId, patientName, signal);
    if (done.ok || done.error !== "busy" || tries >= RX_BUSY_RETRIES) return done;
    const sec = Math.min(done.retryAfterSec ?? BUSY_DEFAULT_SEC, BUSY_MAX_WAIT_SEC);
    if (!(await wait(sec, signal))) return done;
  }
}

/**
 * Uploads one prepared file (see prepare-file.ts) with the patient's name. Pass `stagingId` from a
 * result that carries one to finish that same upload instead of sending a second copy. The `rx`
 * of a success is the server's record: on a resume its `patientName` is the one first recorded.
 */
export async function uploadRx(
  i: { blob: Blob; patientName: string; stagingId?: string },
  opts: { signal?: AbortSignal } = {},
): Promise<RxUploadResult> {
  const { signal } = opts;
  const patientName = i.patientName.trim();
  if (i.stagingId) {
    const done = await finalise(i.stagingId, patientName, signal);
    // Gone with no record of ours: it may never have committed. Not a success, not "expired".
    if (!done.ok && done.error === "upload_expired") return { ok: false, error: "upload_unknown" };
    return withSlot(done, i.stagingId);
  }
  const sent = await stageAndSend(i.blob, signal);
  if (!sent.ok) return sent;
  return withSlot(await finalise(sent.stagingId, patientName, signal), sent.stagingId);
}

/**
 * A finalise whose outcome is open carries its slot, so the next send resumes it instead of
 * uploading a copy: `upload_unconfirmed`, a request lost in transit or timed out (`network`, M4),
 * and `busy` after the bounded retries. Every other answer settles the slot.
 */
const RESUMABLE: readonly RxUploadError[] = ["upload_unconfirmed", "network", "busy"];
const withSlot = (r: RxUploadResult, stagingId: string): RxUploadResult =>
  !r.ok && RESUMABLE.includes(r.error) ? { ...r, stagingId } : r;

/** The signed-in shopper's prescriptions, newest first (at most 50). */
export async function listRx(
  signal?: AbortSignal,
): Promise<
  { ok: true; items: RxListItem[] } | { ok: false; error: "unauthenticated" | "network" }
> {
  const r = await request("/api/prescriptions", { method: "GET" }, SHORT_TIMEOUT_MS, signal);
  if (r?.status === 401) return { ok: false, error: "unauthenticated" };
  const items = r?.status === 200 ? r.body?.items : undefined;
  return Array.isArray(items)
    ? { ok: true, items: items as RxListItem[] }
    : { ok: false, error: "network" };
}
