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

/** Parses a JSON request body against a schema, throwing HttpError on any problem. */
export async function readJson<T>(req: Request, schema: z.ZodType<T>): Promise<T> {
  const type = req.headers.get("content-type")?.trim().toLowerCase() ?? "";
  if (!type.startsWith("application/json")) {
    throw new HttpError(415, "unsupported_media_type");
  }
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw new HttpError(400, "invalid_json");
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) throw new HttpError(400, "invalid_request");
  return parsed.data;
}

/** Wraps a route handler so every failure becomes a safe JSON error response. */
export function withErrors(
  handler: (req: Request) => Promise<Response>,
): (req: Request) => Promise<Response> {
  return async (req) => {
    try {
      return await handler(req);
    } catch (err) {
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
