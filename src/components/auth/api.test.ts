import { afterEach, describe, expect, it, vi } from "vitest";
import { sendCode } from "./api.ts";

function reply(status: number, body: unknown): Response {
  const text = typeof body === "string" ? body : JSON.stringify(body);
  return new Response(text, { status, headers: { "Content-Type": "application/json" } });
}

function mockFetch(res: Response | Error) {
  const fn = vi.fn(async (_url: string, _init?: RequestInit) => {
    if (res instanceof Error) throw res;
    return res;
  });
  vi.stubGlobal("fetch", fn);
  return fn;
}

function sentBody(fn: ReturnType<typeof mockFetch>): Record<string, unknown> {
  const init = fn.mock.calls[0]![1]!;
  return JSON.parse(init.body as string) as Record<string, unknown>;
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("sendCode", () => {
  it("200 is ok and posts channel and identifier", async () => {
    const fn = mockFetch(reply(200, { ok: true, resendAfterSec: 30 }));
    expect(await sendCode("phone", "9876543210")).toEqual({ ok: true });
    expect(fn.mock.calls[0]![0]).toBe("/api/auth/otp/send");
    const init = fn.mock.calls[0]![1]!;
    expect(init.method).toBe("POST");
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(init.headers).toEqual({ "Content-Type": "application/json" });
    expect(sentBody(fn)).toEqual({ channel: "phone", identifier: "9876543210" });
  });

  it("429 resend_cooldown carries retryAfterSec", async () => {
    mockFetch(reply(429, { error: "resend_cooldown", retryAfterSec: 12 }));
    expect(await sendCode("email", "a@b.co")).toEqual({
      ok: false,
      error: "resend_cooldown",
      retryAfterSec: 12,
    });
  });

  it.each([
    [400, "invalid_identifier"],
    [429, "rate_limited"],
    [503, "delivery_failed"],
  ] as const)("%i %s maps through", async (status, error) => {
    mockFetch(reply(status, { error }));
    expect(await sendCode("phone", "x")).toMatchObject({ ok: false, error });
  });

  it("a rejected fetch is network", async () => {
    mockFetch(new TypeError("offline"));
    expect(await sendCode("phone", "x")).toEqual({ ok: false, error: "network" });
  });

  it("a non-JSON body or unknown error code is network, never a throw", async () => {
    mockFetch(reply(502, "<html>bad gateway</html>"));
    expect(await sendCode("phone", "x")).toEqual({ ok: false, error: "network" });
    mockFetch(reply(500, { error: "internal_error" }));
    expect(await sendCode("phone", "x")).toEqual({ ok: false, error: "network" });
  });

  it("without AbortSignal.timeout it falls back to a timer that aborts the request", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("AbortSignal", {});
    let seen: AbortSignal | undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn((_url: string, init?: RequestInit) => {
        seen = init?.signal ?? undefined;
        return new Promise<Response>((_res, rej) => {
          seen?.addEventListener("abort", () => rej(new DOMException("aborted", "AbortError")));
        });
      }),
    );
    const pending = sendCode("phone", "x");
    await vi.advanceTimersByTimeAsync(15_000);
    expect(await pending).toEqual({ ok: false, error: "network" });
    expect(seen?.aborted).toBe(true);
    vi.useRealTimers();
  });

  it("a 2xx that is not the expected JSON is network, not sent", async () => {
    mockFetch(reply(200, "<html>captive portal</html>"));
    expect(await sendCode("phone", "x")).toEqual({ ok: false, error: "network" });
    mockFetch(reply(200, { nope: true }));
    expect(await sendCode("phone", "x")).toEqual({ ok: false, error: "network" });
    mockFetch(reply(200, ""));
    expect(await sendCode("phone", "x")).toEqual({ ok: false, error: "network" });
  });

  it.each([
    [400, { error: "invalid_request" }],
    [400, { error: "invalid_json" }],
  ])("a %i %j is invalid_identifier", async (status, body) => {
    mockFetch(reply(status, body));
    expect(await sendCode("email", "x")).toEqual({ ok: false, error: "invalid_identifier" });
  });

  it.each([
    [403, { error: "bad_origin" }],
    [415, { error: "unsupported_media_type" }],
    [500, { error: "internal_error" }],
    [503, "<html>"],
  ])("a %i %j is network", async (status, body) => {
    mockFetch(reply(status, body));
    expect(await sendCode("email", "x")).toEqual({ ok: false, error: "network" });
  });

  it("ignores a negative retryAfterSec", async () => {
    mockFetch(reply(429, { error: "rate_limited", retryAfterSec: -5 }));
    expect(await sendCode("phone", "x")).toEqual({ ok: false, error: "rate_limited" });
  });

  it("ignores a non-numeric retryAfterSec", async () => {
    mockFetch(reply(429, { error: "rate_limited", retryAfterSec: "soon" }));
    expect(await sendCode("phone", "x")).toEqual({ ok: false, error: "rate_limited" });
  });
});
