import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { EnvError } from "./env";
import { HttpError, jsonResponse, readJson, withErrors } from "./http";
import { jsonPost } from "../../tests/helpers/http";

const Body = z.object({ a: z.string() });

async function thrown(p: Promise<unknown>): Promise<HttpError> {
  try {
    await p;
  } catch (e) {
    if (e instanceof HttpError) return e;
    throw e;
  }
  throw new Error("did not throw");
}

describe("jsonResponse", () => {
  it("sets no-store and JSON content type", async () => {
    const res = jsonResponse({ ok: true }, { status: 201, headers: { "x-a": "1" } });
    expect(res.status).toBe(201);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(res.headers.get("x-a")).toBe("1");
    expect(res.headers.get("content-type")).toContain("application/json");
    expect(await res.json()).toEqual({ ok: true });
  });
});

describe("readJson", () => {
  it("parses a valid body", async () => {
    expect(await readJson(jsonPost("/x", { a: "b" }), Body)).toEqual({ a: "b" });
  });
  it("accepts a charset parameter", async () => {
    const req = jsonPost("/x", { a: "b" }, { contentType: "application/json; charset=utf-8" });
    expect(await readJson(req, Body)).toEqual({ a: "b" });
  });
  it("415 for a non-JSON content type", async () => {
    const e = await thrown(readJson(jsonPost("/x", "a", { contentType: "text/plain" }), Body));
    expect([e.status, e.code]).toEqual([415, "unsupported_media_type"]);
  });
  it("415 for a missing content type", async () => {
    const req = new Request("http://localhost:3000/x", { method: "POST", body: "{}" });
    const e = await thrown(readJson(req, Body));
    expect(e.status).toBe(415);
  });
  it("415 for a content type that merely starts with application/json", async () => {
    const e = await thrown(
      readJson(jsonPost("/x", { a: "b" }, { contentType: "application/jsonp" }), Body),
    );
    expect([e.status, e.code]).toEqual([415, "unsupported_media_type"]);
  });
  it("accepts uppercase type with spaced parameters", async () => {
    const req = jsonPost("/x", { a: "b" }, { contentType: "Application/JSON ; charset=utf-8" });
    expect(await readJson(req, Body)).toEqual({ a: "b" });
  });
  it("413 when content-length exceeds 16 KB", async () => {
    const big = JSON.stringify({ a: "x".repeat(17 * 1024) });
    const e = await thrown(readJson(jsonPost("/x", big), Body));
    expect([e.status, e.code]).toEqual([413, "payload_too_large"]);
  });
  it("413 for an over-cap body without a content-length header", async () => {
    const chunk = new TextEncoder().encode("x".repeat(1024));
    let sent = 0;
    const stream = new ReadableStream<Uint8Array>({
      pull(c) {
        if (sent++ < 40) c.enqueue(chunk);
        else c.close();
      },
    });
    const req = new Request("http://localhost:3000/x", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: stream,
      duplex: "half",
    } as RequestInit);
    const e = await thrown(readJson(req, Body));
    expect([e.status, e.code]).toEqual([413, "payload_too_large"]);
  });
  it("accepts a body just under the cap", async () => {
    const ok = JSON.stringify({ a: "x".repeat(15 * 1024) });
    expect((await readJson(jsonPost("/x", ok), Body)).a.length).toBe(15 * 1024);
  });
  it("accepts exactly 16384 bytes and rejects 16385", async () => {
    const exact = (bytes: number) => `{"a":"${"x".repeat(bytes - 8)}"}`;
    expect(exact(16384)).toHaveLength(16384);
    expect((await readJson(jsonPost("/x", exact(16384)), Body)).a).toHaveLength(16376);
    const e = await thrown(readJson(jsonPost("/x", exact(16385)), Body));
    expect([e.status, e.code]).toEqual([413, "payload_too_large"]);
  });
  it("413 when Content-Length lies small but the body is over the cap", async () => {
    const big = JSON.stringify({ a: "x".repeat(20 * 1024) });
    const req = new Request("http://localhost:3000/x", {
      method: "POST",
      headers: { "content-type": "application/json", "content-length": "10" },
      body: big,
    });
    const e = await thrown(readJson(req, Body));
    expect([e.status, e.code]).toEqual([413, "payload_too_large"]);
  });
  it("400 invalid_json for malformed JSON", async () => {
    const e = await thrown(readJson(jsonPost("/x", "{"), Body));
    expect([e.status, e.code]).toEqual([400, "invalid_json"]);
  });
  it("400 invalid_request for a schema mismatch", async () => {
    const e = await thrown(readJson(jsonPost("/x", { a: 1 }), Body));
    expect([e.status, e.code]).toEqual([400, "invalid_request"]);
  });
});

describe("withErrors", () => {
  const call = (fn: () => Promise<Response>) =>
    withErrors(fn)(new Request("http://localhost:3000/x"));

  it("passes a handler response through", async () => {
    const res = await call(async () => jsonResponse({ ok: 1 }));
    expect(res.status).toBe(200);
  });

  it("maps HttpError with Retry-After", async () => {
    const res = await call(async () => {
      throw new HttpError(429, "rate_limited", 7);
    });
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("7");
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toEqual({ error: "rate_limited", retryAfterSec: 7 });
  });

  it("maps HttpError without retryAfterSec to a bare error and no Retry-After", async () => {
    const res = await call(async () => {
      throw new HttpError(403, "bad_origin");
    });
    expect(res.headers.get("retry-after")).toBeNull();
    expect(await res.json()).toEqual({ error: "bad_origin" });
  });

  it("hides unknown error details and logs only the name", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await call(async () => {
      throw new Error("secret detail");
    });
    expect(res.status).toBe(500);
    const text = await res.text();
    expect(JSON.parse(text)).toEqual({ error: "internal_error" });
    expect(text).not.toContain("secret detail");
    expect(JSON.stringify(spy.mock.calls)).not.toContain("secret detail");
    expect(spy).toHaveBeenCalledWith("route error", "Error");
    spy.mockRestore();
  });

  it("maps EnvError to 500 server_misconfigured", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await call(async () => {
      throw new EnvError("Missing required environment variable OTP_PEPPER");
    });
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "server_misconfigured" });
    spy.mockRestore();
  });
});
