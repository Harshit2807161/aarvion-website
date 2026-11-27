/**
 * Browser client for the cart routes (`src/app/api/cart/**`). It talks to the HTTP contracts only
 * and imports the server's types with `import type`. Nothing here throws: a transport failure, a
 * 15 s timeout, a non-JSON body, a body that is not a cart or any status the UI cannot act on
 * becomes `{ ok: false, error: "network" }`. A refusal that carries the unchanged cart (404, a
 * 409 cap) returns it as `view`. Nothing is logged: slugs and quantities are the shopper's.
 */
import type { CartView } from "@/server/cart/service";
import { capLines, type CartLine } from "@/server/cart/rules";

export type CartApiError =
  | "unauthenticated"
  | "product_not_found"
  | "product_limit"
  | "order_limit"
  | "rate_limited"
  | "network";

export type CartApiResult =
  | { ok: true; view: CartView & { trimmed?: boolean } }
  | { ok: false; error: CartApiError; view?: CartView };

const REQUEST_TIMEOUT_MS = 15_000;

type Reply = { status: number; body: Record<string, unknown> | null } | null;

function timeoutSignal(ms: number): { signal: AbortSignal; clear: () => void } {
  if (typeof AbortSignal.timeout === "function") {
    return { signal: AbortSignal.timeout(ms), clear: () => {} };
  }
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), ms);
  return { signal: ctl.signal, clear: () => clearTimeout(timer) };
}

async function call(path: string, method: string, payload?: unknown): Promise<Reply> {
  const { signal, clear } = timeoutSignal(REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(path, {
      method,
      credentials: "same-origin",
      cache: "no-store",
      signal,
      headers: payload === undefined ? undefined : { "Content-Type": "application/json" },
      body: payload === undefined ? undefined : JSON.stringify(payload),
    });
    let body: Record<string, unknown> | null = null;
    try {
      const parsed: unknown = await res.json();
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        body = parsed as Record<string, unknown>;
      }
    } catch {
      body = null;
    }
    return { status: res.status, body };
  } catch {
    return null;
  } finally {
    clear();
  }
}

/** The body as a cart view, or undefined when it does not have a cart's shape. */
function asView(v: unknown): (CartView & { trimmed?: boolean }) | undefined {
  if (!v || typeof v !== "object") return undefined;
  const o = v as Record<string, unknown>;
  if (!Array.isArray(o.lines) || !Array.isArray(o.removed)) return undefined;
  if (!o.totals || typeof o.totals !== "object") return undefined;
  return o as unknown as CartView & { trimmed?: boolean };
}

const REFUSALS = ["product_limit", "order_limit"] as const;

async function run(path: string, method: string, payload?: unknown): Promise<CartApiResult> {
  const r = await call(path, method, payload);
  if (!r) return { ok: false, error: "network" };
  if (r.status === 200) {
    const view = asView(r.body);
    return view ? { ok: true, view } : { ok: false, error: "network" };
  }
  if (r.status === 401) return { ok: false, error: "unauthenticated" };
  if (r.status === 429) return { ok: false, error: "rate_limited" };
  const view = asView(r.body?.cart);
  if (r.status === 404 && r.body?.error === "product_not_found" && view) {
    return { ok: false, error: "product_not_found", view };
  }
  const refusal = REFUSALS.find((e) => e === r.body?.error);
  if (r.status === 409 && refusal && view) return { ok: false, error: refusal, view };
  return { ok: false, error: "network" };
}

const itemPath = (slug: string) => `/api/cart/items/${encodeURIComponent(slug)}`;

/** The signed-in user's cart, priced from Mongo. */
export const getCart = () => run("/api/cart", "GET");
/** Adds `qty` packs (1 to 10). */
export const addItem = (slug: string, qty: number) => run("/api/cart/items", "POST", { slug, qty });
/** Sets a line (0 to 10; 0 removes it). */
export const setQty = (slug: string, qty: number) => run(itemPath(slug), "PUT", { qty });
export const removeItem = (slug: string) => run(itemPath(slug), "DELETE");

/** The guest lines, cut to what the route accepts (at most 20 packs) so a stale cart never gets a 400. */
function sendable(lines: readonly CartLine[]): CartLine[] {
  return capLines(lines).lines;
}
/** Folds the guest cart into the signed-in user's. */
export const mergeCart = (lines: readonly CartLine[]) =>
  run("/api/cart/merge", "POST", { lines: sendable(lines) });
/** Prices lines without a session; nothing is written. */
export const quoteCart = (lines: readonly CartLine[]) =>
  run("/api/cart/quote", "POST", { lines: sendable(lines) });
