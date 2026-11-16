export const TEST_ORIGIN = "http://localhost:3000";

export type JsonPostOpts = {
  /** `null` omits the Origin header. */
  origin?: string | null;
  ip?: string;
  cookie?: string;
  contentType?: string;
};

/** Builds a same-origin JSON POST by default; every default can be overridden. */
export function jsonPost(path: string, body: unknown, opts: JsonPostOpts = {}): Request {
  const headers: Record<string, string> = {
    "content-type": opts.contentType ?? "application/json",
    "x-real-ip": opts.ip ?? "203.0.113.10",
  };
  const origin = opts.origin === undefined ? TEST_ORIGIN : opts.origin;
  if (origin !== null) headers.origin = origin;
  if (opts.cookie) headers.cookie = opts.cookie;
  return new Request(new URL(path, TEST_ORIGIN), {
    method: "POST",
    headers,
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

export function getReq(path: string, opts: { cookie?: string } = {}): Request {
  const headers: Record<string, string> = { "x-real-ip": "203.0.113.10" };
  if (opts.cookie) headers.cookie = opts.cookie;
  return new Request(new URL(path, TEST_ORIGIN), { method: "GET", headers });
}
