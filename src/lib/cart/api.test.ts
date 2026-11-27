import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { addItem, getCart, mergeCart, quoteCart, removeItem, setQty } from "./api";

const view = { lines: [], totals: { packs: 0, payablePaise: 0 }, removed: [] };
const reply = (status: number, body: unknown) =>
  new Response(typeof body === "string" ? body : JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  fetchMock = vi.fn(async () => reply(200, view));
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe("cart api", () => {
  it("returns the view on 200", async () => {
    expect(await getCart()).toEqual({ ok: true, view });
  });

  it("a 409 cap carries the unchanged cart", async () => {
    fetchMock.mockResolvedValue(reply(409, { error: "order_limit", cart: view }));
    expect(await addItem("a", 1)).toEqual({ ok: false, error: "order_limit", view });
    fetchMock.mockResolvedValue(reply(409, { error: "product_limit", cart: view }));
    expect(await setQty("a", 10)).toMatchObject({ ok: false, error: "product_limit" });
  });

  it("a 404 product_not_found carries the cart", async () => {
    fetchMock.mockResolvedValue(reply(404, { error: "product_not_found", cart: view }));
    expect(await addItem("a", 1)).toEqual({ ok: false, error: "product_not_found", view });
  });

  it("maps 401 and 429", async () => {
    fetchMock.mockResolvedValue(reply(401, { error: "unauthenticated" }));
    expect(await getCart()).toEqual({ ok: false, error: "unauthenticated" });
    fetchMock.mockResolvedValue(reply(429, { error: "rate_limited" }));
    expect(await getCart()).toEqual({ ok: false, error: "rate_limited" });
  });

  it("a transport failure or timeout is network, and nothing throws", async () => {
    fetchMock.mockRejectedValue(new DOMException("timed out", "TimeoutError"));
    expect(await getCart()).toEqual({ ok: false, error: "network" });
    fetchMock.mockRejectedValue(new TypeError("offline"));
    expect(await removeItem("a")).toEqual({ ok: false, error: "network" });
  });

  it("a non-JSON 200, a body that is not a cart, and an unexpected status are network", async () => {
    fetchMock.mockResolvedValue(reply(200, "<html>"));
    expect(await getCart()).toEqual({ ok: false, error: "network" });
    fetchMock.mockResolvedValue(reply(200, { lines: "x" }));
    expect(await getCart()).toEqual({ ok: false, error: "network" });
    for (const status of [400, 403, 409, 500]) {
      fetchMock.mockResolvedValue(reply(status, { error: "cart_conflict" }));
      expect(await getCart()).toEqual({ ok: false, error: "network" });
    }
  });

  it("sends the contract: method, path, same-origin credentials and a JSON body", async () => {
    await addItem("sacuwin-100", 2);
    await setQty("a b", 0);
    await removeItem("sacuwin-100");
    const calls = fetchMock.mock.calls.map(([url, init]) => [url, init.method, init.body]);
    expect(calls).toEqual([
      ["/api/cart/items", "POST", JSON.stringify({ slug: "sacuwin-100", qty: 2 })],
      ["/api/cart/items/a%20b", "PUT", JSON.stringify({ qty: 0 })],
      ["/api/cart/items/sacuwin-100", "DELETE", undefined],
    ]);
    expect(fetchMock.mock.calls[0]![1].credentials).toBe("same-origin");
    expect(fetchMock.mock.calls[0]![1].headers).toEqual({ "Content-Type": "application/json" });
  });

  it("cuts merge and quote lines to what the route accepts", async () => {
    const lines = [
      { slug: "a", qty: 10 },
      { slug: "b", qty: 10 },
      { slug: "c", qty: 10 },
      { slug: "a", qty: 1 },
    ];
    await mergeCart(lines);
    await quoteCart(lines);
    for (const [, init] of fetchMock.mock.calls) {
      expect(JSON.parse(init.body)).toEqual({
        lines: [
          { slug: "a", qty: 10 },
          { slug: "b", qty: 10 },
        ],
      });
    }
    expect(fetchMock.mock.calls.map((c) => c[0])).toEqual(["/api/cart/merge", "/api/cart/quote"]);
  });
});
