/**
 * Browser client for the prescription routes (R5; shapes in docs/dev/architecture.md). It talks
 * to the HTTP contracts only and imports src/server/** for types alone. No function throws: a
 * transport failure, a timeout, an abort, a non-JSON body or an unexpected status all become a
 * safe `ok: false` result (`network`). Nothing here logs: names and file bytes are personal data.
 *
 * An upload is three steps: a staging slot, the bytes (by the slot's `mode`), then finalise.
 * Only `direct` slots (memory and local stores) are sent so far. Nothing is retried yet: a 503
 * `busy` and a 500 `upload_unconfirmed` (the record may exist, so it must never be resent
 * blindly) come back as they are.
 */
import type { RxFileError } from "@/server/prescriptions/file-check";
import type { RxListItem } from "@/server/prescriptions/review";

export type { RxListItem };

export type RxUploadError =
  | "unauthenticated"
  | "rate_limited"
  | "upload_expired"
  | "upload_unconfirmed"
  | "invalid_request"
  | "network"
  | RxFileError
  | "file_missing";

export type RxUploadResult =
  { ok: true; rx: RxListItem } | { ok: false; error: RxUploadError; retryAfterSec?: number };

/** The bytes may be 8 MB on a phone; finalising may take the route's whole 60 s. */
const PUT_TIMEOUT_MS = 120_000;
const FINALISE_TIMEOUT_MS = 70_000;
const SHORT_TIMEOUT_MS = 15_000;
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

async function sendDirect(slot: Slot, blob: Blob, signal?: AbortSignal): Promise<"ok" | Fail> {
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
  const r = await put();
  if (r?.status === 204) return "ok";
  if (r?.status === 404) return { ok: false, error: "upload_expired" };
  if (r?.status === 413) return { ok: false, error: "too_large" };
  if (r?.status === 400) return { ok: false, error: "empty" };
  return common(r);
}

async function stageAndSend(
  blob: Blob,
  signal?: AbortSignal,
): Promise<{ ok: true; stagingId: string } | Fail> {
  const staged = await stage(signal);
  if (!staged.ok) return staged;
  const { slot } = staged;
  // The Blob client-token path (FILE_STORE=blob) follows in the next change.
  if (slot.mode !== "direct") return { ok: false, error: "network" };
  const sent = await sendDirect(slot, blob, signal);
  return sent === "ok" ? { ok: true, stagingId: slot.stagingId } : sent;
}

async function finalise(
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
  if (r?.status === 201) {
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

/** Uploads one prepared file (see prepare-file.ts) with the patient's name. */
export async function uploadRx(
  i: { blob: Blob; patientName: string },
  opts: { signal?: AbortSignal } = {},
): Promise<RxUploadResult> {
  const { signal } = opts;
  const patientName = i.patientName.trim();
  const sent = await stageAndSend(i.blob, signal);
  if (!sent.ok) return sent;
  return finalise(sent.stagingId, patientName, signal);
}
