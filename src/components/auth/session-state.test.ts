import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchSessionState } from "./session-state";

function reply(status: number, body: unknown): Response {
  const text = typeof body === "string" ? body : JSON.stringify(body);
  return new Response(text, { status, headers: { "Content-Type": "application/json" } });
}

function mockFetch(res: Response | Error) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      if (res instanceof Error) throw res;
      return res;
    }),
  );
}

afterEach(() => vi.unstubAllGlobals());

describe("fetchSessionState", () => {
  it("in, with the name or null", async () => {
    mockFetch(reply(200, { user: { name: "Asha" } }));
    expect(await fetchSessionState()).toEqual({ state: "in", name: "Asha" });
    mockFetch(reply(200, { user: {} }));
    expect(await fetchSessionState()).toEqual({ state: "in", name: null });
  });

  it("out only on a 200 that says there is no user", async () => {
    mockFetch(reply(200, { user: null }));
    expect(await fetchSessionState()).toEqual({ state: "out" });
  });

  it("unknown on a failure, a 5xx, a non-JSON body or the wrong shape", async () => {
    mockFetch(new Error("offline"));
    expect(await fetchSessionState()).toEqual({ state: "unknown" });
    mockFetch(reply(500, { error: "internal_error" }));
    expect(await fetchSessionState()).toEqual({ state: "unknown" });
    mockFetch(reply(200, "<html>"));
    expect(await fetchSessionState()).toEqual({ state: "unknown" });
    mockFetch(reply(200, { nothing: true }));
    expect(await fetchSessionState()).toEqual({ state: "unknown" });
    mockFetch(reply(200, { user: "x" }));
    expect(await fetchSessionState()).toEqual({ state: "unknown" });
  });
});
