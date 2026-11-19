import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SearchResult } from "@/lib/catalogue/search-result";
import { SEARCH_DEBOUNCE_MS, useProductSearch } from "./use-product-search";

const hit = (slug: string): SearchResult => ({
  slug,
  name: slug,
  salt: "salt",
  pack: "10 tablets",
  mrpPaise: 10000,
  pricePaise: 8000,
  image: null,
});

function json(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(typeof body === "string" ? body : JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

let fetchMock: ReturnType<typeof vi.fn>;
const urls = () => fetchMock.mock.calls.map((c) => c[0] as string);

beforeEach(() => {
  vi.useFakeTimers();
  fetchMock = vi.fn(async () => json(200, { results: [hit("x")] }));
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const flush = (ms = SEARCH_DEBOUNCE_MS) => act(() => vi.advanceTimersByTimeAsync(ms));

describe("useProductSearch", () => {
  it("debounces: sa then sacu within 100 ms sends one fetch, after 150 ms", async () => {
    const { result, rerender } = renderHook(({ q }) => useProductSearch(q, null), {
      initialProps: { q: "sa" },
    });
    await flush(60);
    rerender({ q: "sacu" });
    await flush(SEARCH_DEBOUNCE_MS - 1);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.current.status).toBe("loading");
    await flush(1);
    expect(urls()).toEqual(["/api/products?q=sacu"]);
    expect(result.current.status).toBe("done");
    expect(result.current.results.map((r) => r.slug)).toEqual(["x"]);
  });

  it("sends nothing for an empty or symbol-only query with no strength", async () => {
    const { result, rerender } = renderHook(({ q }) => useProductSearch(q, null), {
      initialProps: { q: "" },
    });
    await flush(500);
    rerender({ q: "  -- " });
    await flush(500);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.current).toEqual({ results: [], status: "idle" });
  });

  it("fetches a strength alone with an empty q", async () => {
    renderHook(() => useProductSearch("", "100"));
    await flush();
    expect(urls()).toEqual(["/api/products?q=&strength=100"]);
  });

  it("drops a strength that fails STRENGTH_RE instead of sending it", async () => {
    renderHook(() => useProductSearch("tel", "10x"));
    await flush();
    expect(urls()).toEqual(["/api/products?q=tel"]);
    const { result } = renderHook(() => useProductSearch("", "1234567"));
    await flush(500);
    expect(urls()).toHaveLength(1);
    expect(result.current.status).toBe("idle");
  });

  it("caps the query at 64 characters before sending", async () => {
    renderHook(() => useProductSearch("a".repeat(100), null));
    await flush();
    const q = new URL(urls()[0]!, "http://x").searchParams.get("q")!;
    expect(q).toHaveLength(64);
  });

  it("sends the normalised query, percent-encoded", async () => {
    renderHook(() => useProductSearch("Sacubitril + Valsartan", "50"));
    await flush();
    expect(urls()).toEqual(["/api/products?q=sacubitril%20valsartan&strength=50"]);
  });

  it("aborts the previous request when a new one starts", async () => {
    const signals: AbortSignal[] = [];
    fetchMock.mockImplementation(
      (_u: string, init: RequestInit) =>
        new Promise((_res, rej) => {
          signals.push(init.signal!);
          init.signal!.addEventListener("abort", () => rej(new DOMException("x", "AbortError")));
        }),
    );
    const { rerender, result } = renderHook(({ q }) => useProductSearch(q, null), {
      initialProps: { q: "sac" },
    });
    await flush();
    rerender({ q: "sacu" });
    expect(signals[0]!.aborted).toBe(true);
    await flush();
    expect(signals).toHaveLength(2);
    expect(signals[1]!.aborted).toBe(false);
    expect(result.current.status).toBe("loading");
  });

  it("ignores a slow response for an older query", async () => {
    let resolveSlow: (r: Response) => void = () => {};
    fetchMock
      .mockImplementationOnce(() => new Promise<Response>((r) => (resolveSlow = r)))
      .mockImplementationOnce(async () => json(200, { results: [hit("new")] }));
    const { result, rerender } = renderHook(({ q }) => useProductSearch(q, null), {
      initialProps: { q: "sac" },
    });
    await flush();
    rerender({ q: "sacu" });
    await flush();
    expect(result.current.results.map((r) => r.slug)).toEqual(["new"]);
    await act(async () => resolveSlow(json(200, { results: [hit("old")] })));
    expect(result.current.results.map((r) => r.slug)).toEqual(["new"]);
    expect(result.current.status).toBe("done");
  });

  it("429 gives limited, never retries, and stays limited until the query changes", async () => {
    fetchMock.mockImplementation(async () =>
      json(429, { error: "rate_limited" }, { "Retry-After": "5" }),
    );
    const { result, rerender } = renderHook(({ q }) => useProductSearch(q, null), {
      initialProps: { q: "sacu" },
    });
    await flush();
    expect(result.current.status).toBe("limited");
    rerender({ q: "sacu " }); // same normalised query
    await flush(60_000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe("limited");
    fetchMock.mockImplementation(async () => json(200, { results: [hit("ok")] }));
    rerender({ q: "sacub" });
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.current.status).toBe("done");
  });

  it.each([
    ["500", () => json(500, { error: "boom" })],
    ["400", () => json(400, { error: "query_too_long" })],
    ["non-JSON body", () => json(200, "<html>nope</html>")],
    ["unexpected shape", () => json(200, { results: "no" })],
    ["a malformed result", () => json(200, { results: [{ slug: 1 }] })],
  ])("%s is an error and never throws", async (_n, make) => {
    fetchMock.mockImplementation(async () => make());
    const { result } = renderHook(() => useProductSearch("sacu", null));
    await flush();
    expect(result.current.status).toBe("error");
    expect(result.current.results).toEqual([]);
  });

  it("a network failure is an error", async () => {
    fetchMock.mockRejectedValue(new TypeError("offline"));
    const { result } = renderHook(() => useProductSearch("sacu", null));
    await flush();
    expect(result.current.status).toBe("error");
  });

  it("keeps API order and never logs the query", async () => {
    const spies = (["log", "info", "warn", "error", "debug"] as const).map((m) =>
      vi.spyOn(console, m).mockImplementation(() => {}),
    );
    fetchMock.mockImplementation(async () => json(500, "no"));
    renderHook(() => useProductSearch("secret-drug", null));
    await flush();
    fetchMock.mockImplementation(async () => json(200, { results: [hit("b"), hit("a")] }));
    const { result } = renderHook(() => useProductSearch("zzz", null));
    await flush();
    expect(result.current.results.map((r) => r.slug)).toEqual(["b", "a"]);
    spies.forEach((s) => expect(s).not.toHaveBeenCalled());
  });

  it("returns idle and no results once the query is cleared", async () => {
    const { result, rerender } = renderHook(({ q }) => useProductSearch(q, null), {
      initialProps: { q: "sacu" },
    });
    await flush();
    expect(result.current.results).toHaveLength(1);
    rerender({ q: "" });
    expect(result.current).toEqual({ results: [], status: "idle" });
  });
});
