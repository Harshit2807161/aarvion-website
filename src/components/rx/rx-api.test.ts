import { globSync, readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { rxListItem } from "../../../tests/helpers/rx-list-item";
import { listRx, RX_BUSY_RETRIES, uploadRx } from "./rx-api.ts";

const upload = vi.hoisted(() => vi.fn());
vi.mock("@vercel/blob/client", () => ({ upload }));

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
  // Reset here, not in beforeEach: under Vitest 5 a mockReset in beforeEach makes a later throw
  // from the mock fail the test even when the code under test catches it.
  upload.mockReset();
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
    expect(upload).not.toHaveBeenCalled();
  });

  it("client-token mode: uploads to Blob privately with the slot as the payload", async () => {
    const fn = mockFetch(staged("client-token"), reply(201, { rx: RX }));
    upload.mockResolvedValue({ pathname: PATHNAME });
    expect(await uploadRx(input)).toEqual({ ok: true, rx: RX });
    expect(upload).toHaveBeenCalledOnce();
    const [pathname, body, options] = upload.mock.calls[0]!;
    expect(pathname).toBe(PATHNAME);
    expect(body).toBe(blob);
    expect(options).toMatchObject({
      access: "private",
      handleUploadUrl: "/api/prescriptions/blob-token",
      clientPayload: STAGING_ID,
      contentType: "image/jpeg",
    });
    expect(calls(fn)).toEqual(["POST /api/prescriptions/staging", "POST /api/prescriptions"]);
  });

  it("client-token mode: Blob's 'already exists' means it landed, so it finalises", async () => {
    mockFetch(staged("client-token"), reply(201, { rx: RX }));
    upload.mockImplementation(async () => {
      throw new Error("Vercel Blob: This blob already exists");
    });
    expect(await uploadRx(input)).toEqual({ ok: true, rx: RX });
  });

  it("client-token mode: any other Blob failure is a network error, with no finalise", async () => {
    const fn = mockFetch(staged("client-token"));
    upload.mockImplementation(async () => {
      throw new Error("Vercel Blob: Failed to retrieve the client token");
    });
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

  it("retries a PUT that failed in transit once (the same bytes are idempotent)", async () => {
    const fn = mockFetch(
      staged("direct"),
      new TypeError("offline"),
      reply(204),
      reply(201, { rx: RX }),
    );
    expect(await uploadRx(input)).toEqual({ ok: true, rx: RX });
    expect(fn).toHaveBeenCalledTimes(4);
  });

  it("a PUT 409 (the slot holds other bytes) starts one fresh slot", async () => {
    const fn = mockFetch(
      staged("direct"),
      reply(409, { error: "already_uploaded" }),
      staged("direct"),
      reply(204),
      reply(201, { rx: RX }),
    );
    expect(await uploadRx(input)).toEqual({ ok: true, rx: RX });
    expect(calls(fn).filter((c) => c === "POST /api/prescriptions/staging")).toHaveLength(2);
  });

  it("retries 503 busy after Retry-After, a bounded number of times", async () => {
    vi.useFakeTimers();
    const busy = () => reply(503, { error: "busy", retryAfterSec: 5 }, { "Retry-After": "5" });
    const fn = mockFetch(
      staged("direct"),
      reply(204),
      ...Array.from({ length: 1 + RX_BUSY_RETRIES }, busy),
    );
    const done = uploadRx(input);
    for (let i = 0; i < RX_BUSY_RETRIES; i++) await vi.advanceTimersByTimeAsync(5000);
    // Still busy after the bounded retries: the slot is handed back, so a later send resumes it.
    expect(await done).toEqual({
      ok: false,
      error: "busy",
      retryAfterSec: 5,
      stagingId: STAGING_ID,
    });
    expect(fn).toHaveBeenCalledTimes(3 + RX_BUSY_RETRIES);
  });

  it("a busy finalise that then succeeds is ok", async () => {
    vi.useFakeTimers();
    mockFetch(
      staged("direct"),
      reply(204),
      reply(503, { error: "busy", retryAfterSec: 5 }),
      reply(201, { rx: RX }),
    );
    const done = uploadRx(input);
    await vi.advanceTimersByTimeAsync(5000);
    expect(await done).toEqual({ ok: true, rx: RX });
  });

  it("upload_unconfirmed is never retried and hands back the slot to resume", async () => {
    const fn = mockFetch(
      staged("direct"),
      reply(204),
      reply(500, { error: "upload_unconfirmed", retryable: true, retryAfterSec: 30 }),
    );
    expect(await uploadRx(input)).toEqual({
      ok: false,
      error: "upload_unconfirmed",
      retryAfterSec: 30,
      stagingId: STAGING_ID,
    });
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("resuming finalises the same slot without sending the file again", async () => {
    const fn = mockFetch(reply(201, { rx: RX }));
    expect(await uploadRx({ ...input, stagingId: STAGING_ID })).toEqual({ ok: true, rx: RX });
    expect(calls(fn)).toEqual(["POST /api/prescriptions"]);
  });

  it("a resumed finalise answered 200 (already finalised, #244) is a success with the server's record", async () => {
    // The shopper edited the name before resending; the record keeps the name first recorded.
    const recorded = { ...RX, patientName: "Asha Rao" };
    mockFetch(reply(200, { rx: recorded }));
    expect(await uploadRx({ ...input, patientName: "Asha R.", stagingId: STAGING_ID })).toEqual({
      ok: true,
      rx: recorded,
    });
  });

  it("a resumed 410 is upload_unknown, never a success, and reads no list", async () => {
    const fn = mockFetch(reply(410, { error: "upload_expired" }), reply(200, { items: [RX] }));
    expect(await uploadRx({ ...input, stagingId: STAGING_ID })).toEqual({
      ok: false,
      error: "upload_unknown",
    });
    expect(calls(fn)).toEqual(["POST /api/prescriptions"]);
  });

  it("a finalise lost in transit after the bytes were sent hands back the slot (M4)", async () => {
    const fn = mockFetch(staged("direct"), reply(204), new TypeError("offline"));
    expect(await uploadRx(input)).toEqual({ ok: false, error: "network", stagingId: STAGING_ID });
    expect(fn).toHaveBeenCalledTimes(3);
    // A failure before the bytes landed carries no slot: there is nothing to resume.
    mockFetch(new TypeError("offline"));
    expect(await uploadRx(input)).toEqual({ ok: false, error: "network" });
  });

  it("settled answers carry no slot", async () => {
    mockFetch(
      staged("direct"),
      reply(204),
      reply(422, { error: "invalid_file", reason: "corrupt" }),
    );
    expect(await uploadRx(input)).toEqual({ ok: false, error: "corrupt" });
    mockFetch(reply(410, { error: "upload_expired" }));
    expect(await uploadRx({ ...input, stagingId: STAGING_ID })).not.toHaveProperty("stagingId");
  });

  it("a 400 is invalid_request, and a 2xx that is not the expected shape is network", async () => {
    mockFetch(staged("direct"), reply(204), reply(400, { error: "invalid_request" }));
    expect(await uploadRx(input)).toEqual({ ok: false, error: "invalid_request" });
    mockFetch(reply(201, { nope: true }));
    expect(await uploadRx(input)).toEqual({ ok: false, error: "network" });
  });
});

describe("listRx", () => {
  it("returns the items, 401 as unauthenticated and anything else as network", async () => {
    mockFetch(reply(200, { items: [RX] }));
    expect(await listRx()).toEqual({ ok: true, items: [RX] });
    mockFetch(reply(401, { error: "unauthenticated" }));
    expect(await listRx()).toEqual({ ok: false, error: "unauthenticated" });
    mockFetch(reply(200, { items: "x" }));
    expect(await listRx()).toEqual({ ok: false, error: "network" });
    mockFetch(new TypeError("offline"));
    expect(await listRx()).toEqual({ ok: false, error: "network" });
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
