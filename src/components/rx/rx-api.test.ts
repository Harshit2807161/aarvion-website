import { globSync, readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { rxListItem } from "../../../tests/helpers/rx-list-item";
import { uploadRx } from "./rx-api.ts";

const STAGING_ID = "abcdefghijklmnopqrstuv";
const PATHNAME = `rx-staging/0123456789abcdef01234567/${STAGING_ID}`;
const RX = rxListItem();

function reply(status: number, body?: unknown, headers: Record<string, string> = {}): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}
const staged = (mode: "direct" | "client-token") =>
  reply(201, { stagingId: STAGING_ID, mode, pathname: PATHNAME });

/** A fetch that answers each call with the next response (or throws an Error) in order. */
function mockFetch(...replies: (Response | Error)[]) {
  const fn = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(async () => {
    const next = replies.shift();
    if (!next) throw new Error("unexpected fetch");
    if (next instanceof Error) throw next;
    return next;
  });
  vi.stubGlobal("fetch", fn);
  return fn;
}
const calls = (fn: ReturnType<typeof mockFetch>) =>
  fn.mock.calls.map(([url, init]) => `${init?.method ?? "GET"} ${url}`);

const blob = new Blob([new Uint8Array(1000)], { type: "image/jpeg" });
const input = { blob, patientName: "  Asha Rao " };

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("uploadRx", () => {
  it("direct mode: staging, then PUT the bytes, then finalise", async () => {
    const fn = mockFetch(staged("direct"), reply(204), reply(201, { rx: RX }));
    expect(await uploadRx(input)).toEqual({ ok: true, rx: RX });
    expect(calls(fn)).toEqual([
      "POST /api/prescriptions/staging",
      `PUT /api/prescriptions/staging/${STAGING_ID}`,
      "POST /api/prescriptions",
    ]);
    expect(fn.mock.calls[1]![1]!.body).toBe(blob);
    expect(JSON.parse(fn.mock.calls[2]![1]!.body as string)).toEqual({
      stagingId: STAGING_ID,
      patientName: "Asha Rao",
      declaration: true,
    });
  });

  it("a client-token slot is not sent yet (the Blob path follows): network, no finalise", async () => {
    const fn = mockFetch(staged("client-token"));
    expect(await uploadRx(input)).toEqual({ ok: false, error: "network" });
    expect(fn).toHaveBeenCalledOnce();
  });

  it("maps a 422 reason to its file error", async () => {
    mockFetch(
      staged("direct"),
      reply(204),
      reply(422, { error: "invalid_file", reason: "too_small" }),
    );
    expect(await uploadRx(input)).toEqual({ ok: false, error: "too_small" });
  });

  it("maps a 410 to upload_expired", async () => {
    mockFetch(staged("direct"), reply(204), reply(410, { error: "upload_expired" }));
    expect(await uploadRx(input)).toEqual({ ok: false, error: "upload_expired" });
  });

  it("a 401 anywhere is unauthenticated", async () => {
    mockFetch(reply(401, { error: "unauthenticated" }));
    expect(await uploadRx(input)).toEqual({ ok: false, error: "unauthenticated" });
  });

  it("a 429 carries the wait, from the body or else Retry-After", async () => {
    mockFetch(reply(429, { error: "rate_limited", retryAfterSec: 1200 }));
    expect(await uploadRx(input)).toEqual({
      ok: false,
      error: "rate_limited",
      retryAfterSec: 1200,
    });
    mockFetch(reply(429, { error: "rate_limited" }, { "Retry-After": "90" }));
    expect(await uploadRx(input)).toEqual({ ok: false, error: "rate_limited", retryAfterSec: 90 });
  });

  it("a PUT 404 (the slot expired) is upload_expired, and a 413 is too_large", async () => {
    mockFetch(staged("direct"), reply(404, { error: "not_found" }));
    expect(await uploadRx(input)).toEqual({ ok: false, error: "upload_expired" });
    mockFetch(staged("direct"), reply(413, { error: "file_too_large" }));
    expect(await uploadRx(input)).toEqual({ ok: false, error: "too_large" });
  });

  it("returns 503 busy and 500 upload_unconfirmed with their waits, never resending", async () => {
    const fn = mockFetch(
      staged("direct"),
      reply(204),
      reply(503, { error: "busy", retryAfterSec: 5 }, { "Retry-After": "5" }),
    );
    expect(await uploadRx(input)).toEqual({ ok: false, error: "busy", retryAfterSec: 5 });
    expect(fn).toHaveBeenCalledTimes(3);
    mockFetch(
      staged("direct"),
      reply(204),
      reply(500, { error: "upload_unconfirmed", retryable: true, retryAfterSec: 30 }),
    );
    expect(await uploadRx(input)).toEqual({
      ok: false,
      error: "upload_unconfirmed",
      retryAfterSec: 30,
    });
  });
  it("a 400 is invalid_request, and a 2xx that is not the expected shape is network", async () => {
    mockFetch(staged("direct"), reply(204), reply(400, { error: "invalid_request" }));
    expect(await uploadRx(input)).toEqual({ ok: false, error: "invalid_request" });
    mockFetch(reply(201, { nope: true }));
    expect(await uploadRx(input)).toEqual({ ok: false, error: "network" });
  });
});

describe("the upload code stays out of first-load JS", () => {
  const root = path.resolve(import.meta.dirname, "../../..");
  // A value import (not `import type`) of any upload module, by any path.
  const LAZY =
    /^\s*(?:import|export)\s+(?!type\b)[^;]*?from\s+["'][^"']*\brx\/(?:rx-upload-form|rx-file-picker|rx-messages|rx-api|rx-copy|prepare-file)["']/m;

  it("no module outside src/components/rx imports the form or client statically", () => {
    const offenders = globSync("src/**/*.{ts,tsx}", { cwd: root })
      .filter((f) => !f.split(path.sep).join("/").startsWith("src/components/rx/"))
      .filter((f) => !/\.test\.tsx?$/.test(f))
      .filter((f) => LAZY.test(readFileSync(path.join(root, f), "utf8")));
    expect(offenders).toEqual([]);
  });
});
