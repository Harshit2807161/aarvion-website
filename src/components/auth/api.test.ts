import type { z } from "zod";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { SignupInput } from "@/server/auth/login";
import { fetchSession, sendCode, verifyCode, type SignupPayload } from "./api.ts";

// Type-level pin in both directions: a field the server adds, drops or renames fails typecheck.
export const _check: z.input<typeof SignupInput> = {} as SignupPayload;
export const _checkBack: SignupPayload = {} as z.input<typeof SignupInput>;

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

describe("verifyCode", () => {
  const signup: SignupPayload = {
    name: "Asha Rao",
    adult: true,
    termsPrivacy: true,
    marketing: false,
  };

  it("200 returns isNewUser and only the name", async () => {
    mockFetch(
      reply(200, {
        user: { id: "1", phone: "9876543210", email: null, role: "customer", name: "Asha" },
        isNewUser: true,
      }),
    );
    expect(await verifyCode("phone", "9876543210", "123456")).toEqual({
      ok: true,
      isNewUser: true,
      user: { name: "Asha" },
    });
  });

  it("an unnamed user gets name null", async () => {
    mockFetch(reply(200, { user: { id: "1", name: null }, isNewUser: false }));
    expect(await verifyCode("email", "a@b.co", "1")).toMatchObject({
      ok: true,
      user: { name: null },
    });
  });

  it("a 200 without the expected shape is network", async () => {
    mockFetch(reply(200, { nope: true }));
    expect(await verifyCode("phone", "x", "1")).toEqual({ ok: false, error: "network" });
  });

  it("400 invalid_code, 409 signup_required", async () => {
    mockFetch(reply(400, { error: "invalid_code" }));
    expect(await verifyCode("phone", "x", "1")).toEqual({ ok: false, error: "invalid_code" });
    mockFetch(reply(409, { error: "signup_required" }));
    expect(await verifyCode("phone", "x", "1")).toEqual({ ok: false, error: "signup_required" });
  });

  it("[C3] 429 rate_limited keeps retryAfterSec", async () => {
    mockFetch(reply(429, { error: "rate_limited", retryAfterSec: 900 }));
    expect(await verifyCode("phone", "x", "1")).toEqual({
      ok: false,
      error: "rate_limited",
      retryAfterSec: 900,
    });
  });

  it("429 too_many_attempts maps likewise", async () => {
    mockFetch(reply(429, { error: "too_many_attempts", retryAfterSec: 60 }));
    expect(await verifyCode("phone", "x", "1")).toEqual({
      ok: false,
      error: "too_many_attempts",
      retryAfterSec: 60,
    });
  });

  it("sends signup only when passed", async () => {
    const a = mockFetch(reply(400, { error: "invalid_code" }));
    await verifyCode("phone", "x", "1");
    expect(sentBody(a)).not.toHaveProperty("signup");
    const b = mockFetch(reply(400, { error: "invalid_code" }));
    await verifyCode("phone", "x", "1", signup);
    expect(sentBody(b).signup).toEqual(signup);
  });

  it("a rejected fetch or garbage response is network", async () => {
    mockFetch(new TypeError("offline"));
    expect(await verifyCode("phone", "x", "1")).toEqual({ ok: false, error: "network" });
    mockFetch(reply(500, "not json"));
    expect(await verifyCode("phone", "x", "1")).toEqual({ ok: false, error: "network" });
    mockFetch(reply(400, { error: "invalid_request" }));
    expect(await verifyCode("phone", "x", "1")).toEqual({ ok: false, error: "network" });
  });

  it("a refused signup body (400 or 413) is signup_required, never invalid_code", async () => {
    mockFetch(reply(400, { error: "invalid_request" }));
    expect(await verifyCode("phone", "x", "1", signup)).toEqual({
      ok: false,
      error: "signup_required",
    });
    mockFetch(reply(413, { error: "payload_too_large" }));
    expect(await verifyCode("phone", "x", "1", signup)).toEqual({
      ok: false,
      error: "signup_required",
    });
  });

  it.each([
    [403, { error: "bad_origin" }],
    [415, { error: "unsupported_media_type" }],
    [500, { error: "internal_error" }],
    [503, "<html>"],
  ])("a %i %j with a signup is network", async (status, body) => {
    mockFetch(reply(status, body));
    expect(await verifyCode("phone", "x", "1", signup)).toEqual({ ok: false, error: "network" });
  });

  it("posts the trimmed name", async () => {
    const fn = mockFetch(reply(400, { error: "invalid_code" }));
    await verifyCode("phone", "x", "1", { ...signup, name: "  Asha Rao  " });
    expect((sentBody(fn).signup as { name: string }).name).toBe("Asha Rao");
    expect(fn.mock.calls[0]![0]).toBe("/api/auth/otp/verify");
    expect(fn.mock.calls[0]![1]!.method).toBe("POST");
  });
});

describe("fetchSession", () => {
  it("signed in returns only the name", async () => {
    const fn = mockFetch(
      reply(200, { user: { id: "1", phone: "9", role: "customer", name: "Asha" } }),
    );
    expect(await fetchSession()).toEqual({ name: "Asha" });
    expect(fn.mock.calls[0]![0]).toBe("/api/auth/session");
    expect(fn.mock.calls[0]![1]!.cache).toBe("no-store");
  });

  it("signed in without a name returns name null", async () => {
    mockFetch(reply(200, { user: { id: "1", name: null } }));
    expect(await fetchSession()).toEqual({ name: null });
  });

  it("signed out, errors and transport failures all return null", async () => {
    mockFetch(reply(200, { user: null }));
    expect(await fetchSession()).toBeNull();
    mockFetch(reply(500, { error: "internal_error" }));
    expect(await fetchSession()).toBeNull();
    mockFetch(reply(200, "<html>"));
    expect(await fetchSession()).toBeNull();
    mockFetch(new TypeError("offline"));
    expect(await fetchSession()).toBeNull();
  });
});
