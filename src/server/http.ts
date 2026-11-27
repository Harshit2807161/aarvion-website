// Ruling F15: `next/navigation` is the single framework import allowed under src/server/**.
import { unstable_rethrow } from "next/navigation";
import type { z } from "zod";
import { EnvError } from "./env.ts";

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly retryAfterSec?: number,
  ) {
    super(code);
    this.name = "HttpError";
  }
}

/** JSON response that is never cached (auth and cart responses are per-user). */
export function jsonResponse(
  body: unknown,
  init: { status?: number; headers?: HeadersInit } = {},
): Response {
  const headers = new Headers(init.headers);
  headers.set("Cache-Control", "no-store");
  headers.set("Content-Type", "application/json");
  return new Response(JSON.stringify(body), { status: init.status ?? 200, headers });
}

export const MAX_JSON_BYTES = 16 * 1024;

/**
 * Reads the whole body as bytes, refusing more than `max` bytes (413 `payload_too_large`) even
 * without a Content-Length: the stream is cancelled as soon as it passes the cap.
 */
export async function readCappedBytes(req: Request, max: number): Promise<Uint8Array> {
  const declared = Number(req.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > max) throw new HttpError(413, "payload_too_large");
  if (!req.body) return new Uint8Array(0);
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > max) {
      await reader.cancel();
      throw new HttpError(413, "payload_too_large");
    }
    chunks.push(value);
  }
  return new Uint8Array(Buffer.concat(chunks));
}

/** Parses a JSON request body (max 16 KB) against a schema, throwing HttpError on any problem. */
export async function readJson<T>(req: Request, schema: z.ZodType<T>): Promise<T> {
  // Exact media type, optionally with parameters: "application/jsonp" must not pass.
  const type = (req.headers.get("content-type") ?? "").split(";")[0]!.trim().toLowerCase();
  if (type !== "application/json") throw new HttpError(415, "unsupported_media_type");
  const text = new TextDecoder().decode(await readCappedBytes(req, MAX_JSON_BYTES));
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new HttpError(400, "invalid_json");
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) throw new HttpError(400, "invalid_request");
  return parsed.data;
}

/**
 * Wraps a route handler so every failure becomes a safe JSON error response. Next's control flow
 * (notFound(), redirect(), a prerender abort from connection()) is rethrown untouched and unlogged.
 * Extra arguments (a dynamic route's `{ params }`) are passed through.
 */
export function withErrors<A extends unknown[] = []>(
  handler: (req: Request, ...rest: A) => Promise<Response>,
): (req: Request, ...rest: A) => Promise<Response> {
  return async (req, ...rest) => {
    try {
      return await handler(req, ...rest);
    } catch (err) {
      unstable_rethrow(err);
      if (err instanceof HttpError) {
        const headers = new Headers();
        if (err.retryAfterSec !== undefined) headers.set("Retry-After", String(err.retryAfterSec));
        return jsonResponse(
          err.retryAfterSec !== undefined
            ? { error: err.code, retryAfterSec: err.retryAfterSec }
            : { error: err.code },
          { status: err.status, headers },
        );
      }
      // Log the error name only: messages can carry identifiers, codes or secrets.
      console.error("route error", err instanceof Error ? err.name : "unknown");
      if (err instanceof EnvError) {
        return jsonResponse({ error: "server_misconfigured" }, { status: 500 });
      }
      return jsonResponse({ error: "internal_error" }, { status: 500 });
    }
  };
}
