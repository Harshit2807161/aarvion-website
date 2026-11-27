export const TEST_ORIGIN = "http://localhost:3000";

export type JsonPostOpts = {
  /** `null` omits the Origin header. */
  origin?: string | null;
  ip?: string;
  cookie?: string;
  contentType?: string;
};

/** Builds a same-origin JSON request (any method); every default can be overridden. A body of `undefined` sends none. */
export function jsonReq(
  method: string,
  path: string,
  body?: unknown,
  opts: JsonPostOpts = {},
): Request {
  const headers: Record<string, string> = { "x-real-ip": opts.ip ?? "203.0.113.10" };
  if (body !== undefined) headers["content-type"] = opts.contentType ?? "application/json";
  const origin = opts.origin === undefined ? TEST_ORIGIN : opts.origin;
  if (origin !== null) headers.origin = origin;
  if (opts.cookie) headers.cookie = opts.cookie;
  return new Request(new URL(path, TEST_ORIGIN), {
    method,
    headers,
    body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
  });
}

/** Builds a same-origin JSON POST by default; every default can be overridden. */
export function jsonPost(path: string, body: unknown, opts: JsonPostOpts = {}): Request {
  return jsonReq("POST", path, body, opts);
}

export function getReq(path: string, opts: { cookie?: string } = {}): Request {
  const headers: Record<string, string> = { "x-real-ip": "203.0.113.10" };
  if (opts.cookie) headers.cookie = opts.cookie;
  return new Request(new URL(path, TEST_ORIGIN), { method: "GET", headers });
}

/** The raw session token from a response's Set-Cookie, or null when none was set. */
export function sessionTokenFrom(res: Response): string | null {
  const m = /^__Host-aarv_sid=([A-Za-z0-9_-]{43});/.exec(res.headers.get("set-cookie") ?? "");
  return m ? m[1]! : null;
}
