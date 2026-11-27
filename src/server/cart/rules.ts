/**
 * Pure cart rules, shared by the server cart (phase K) and the client cart UI. No imports, no
 * I/O, no clock: a component may import this at runtime (see server-imports.test.ts). A cart is
 * an ordered array of `{ slug, qty }`, never a slug-keyed object, so a slug like "__proto__" is
 * an ordinary line. Prices are never held here; `cartTotals` in `catalogue/pricing.ts` derives
 * them from the catalogue's MRP.
 *
 * Every change function returns `{ lines, blocked }`. A refused change, and a change that
 * alters nothing, returns the same array it was given, so callers detect "nothing happened" by
 * identity. Nothing here mutates its input.
 */

export const CART_LIMITS = { perProduct: 10, perOrder: 20 } as const;

export type CartLine = { slug: string; qty: number };
export type CartBlock = "product_limit" | "order_limit";
export type CartChange = { lines: readonly CartLine[]; blocked: CartBlock | null };

/** Total packs across all lines. */
export function cartPacks(lines: readonly CartLine[]): number {
  return lines.reduce((sum, l) => sum + l.qty, 0);
}

function assertInt(name: string, v: number, min: number, max: number): void {
  if (!Number.isInteger(v) || v < min || v > max) {
    throw new RangeError(`${name} must be an integer from ${min} to ${max}`);
  }
}

/**
 * Add `n` packs (an integer 1 to 10) of `slug`; a new slug appends. Refused with
 * `product_limit` past 10 of one product, else `order_limit` past 20 packs in the order.
 */
export function addLine(lines: readonly CartLine[], slug: string, n = 1): CartChange {
  assertInt("n", n, 1, CART_LIMITS.perProduct);
  const at = lines.findIndex((l) => l.slug === slug);
  const have = at === -1 ? 0 : lines[at]!.qty;
  if (have + n > CART_LIMITS.perProduct) return { lines, blocked: "product_limit" };
  if (cartPacks(lines) + n > CART_LIMITS.perOrder) return { lines, blocked: "order_limit" };
  const next = lines.slice();
  if (at === -1) next.push({ slug, qty: n });
  else next[at] = { slug, qty: have + n };
  return { lines: next, blocked: null };
}

/**
 * Set a line to `qty` (an integer 0 to 10); 0 removes it and an absent slug with qty above 0
 * appends. Raising a line can be refused with `order_limit`; lowering never is.
 */
export function setLineQty(lines: readonly CartLine[], slug: string, qty: number): CartChange {
  assertInt("qty", qty, 0, CART_LIMITS.perProduct);
  const at = lines.findIndex((l) => l.slug === slug);
  const have = at === -1 ? 0 : lines[at]!.qty;
  if (qty === have) return { lines, blocked: null };
  if (qty > have && cartPacks(lines) - have + qty > CART_LIMITS.perOrder) {
    return { lines, blocked: "order_limit" };
  }
  if (qty === 0) return { lines: lines.filter((_, i) => i !== at), blocked: null };
  const next = lines.slice();
  if (at === -1) next.push({ slug, qty });
  else next[at] = { slug, qty };
  return { lines: next, blocked: null };
}

/** Remove a line; a missing slug returns the input unchanged. */
export function removeLine(lines: readonly CartLine[], slug: string): CartChange {
  return setLineQty(lines, slug, 0);
}

/** Valid `{ slug: string, qty: integer >= 1 }` entries, first duplicate wins, qty clamped to 10. */
function cleanLines(raw: readonly unknown[]): CartLine[] {
  const seen = new Set<string>();
  const out: CartLine[] = [];
  for (const entry of raw) {
    if (typeof entry !== "object" || entry === null || Array.isArray(entry)) continue;
    const { slug, qty } = entry as { slug?: unknown; qty?: unknown };
    if (typeof slug !== "string" || typeof qty !== "number") continue;
    if (!Number.isInteger(qty) || qty < 1 || seen.has(slug)) continue;
    seen.add(slug);
    out.push({ slug, qty: Math.min(qty, CART_LIMITS.perProduct) });
  }
  return out;
}

/** Cuts `lines` at 20 packs from the end: a later line is shortened or dropped first. */
function cutAtOrderLimit(lines: CartLine[]): { lines: CartLine[]; trimmed: boolean } {
  const out: CartLine[] = [];
  let room: number = CART_LIMITS.perOrder;
  let trimmed = false;
  for (const l of lines) {
    const qty = Math.min(l.qty, room);
    if (qty < l.qty) trimmed = true;
    if (qty > 0) out.push({ slug: l.slug, qty });
    room -= qty;
  }
  return { lines: out, trimmed };
}

/**
 * Makes untrusted input a valid cart: keeps `{ slug: string, qty: integer >= 1 }` entries (the
 * first entry wins on a duplicate slug), clamps each qty to 10 and cuts at 20 packs from the
 * end. `trimmed` is true only when the 20-pack cut removed packs; dropping malformed entries
 * or clamping a line to 10 is not reported.
 */
export function capLines(raw: readonly unknown[]): { lines: CartLine[]; trimmed: boolean } {
  return cutAtOrderLimit(cleanLines(raw));
}

/**
 * The guest cart folded into the server cart at sign-in: the larger quantity per slug, server
 * order first and new guest slugs after, then `capLines`. Idempotent: merging the same guest
 * cart again changes nothing, so a replayed request cannot double a line.
 */
export function mergeLines(
  server: readonly CartLine[],
  guest: readonly CartLine[],
): { lines: CartLine[]; trimmed: boolean } {
  const merged = new Map<string, number>();
  for (const l of [...cleanLines(server), ...cleanLines(guest)]) {
    merged.set(l.slug, Math.max(merged.get(l.slug) ?? 0, l.qty));
  }
  return capLines([...merged].map(([slug, qty]) => ({ slug, qty })));
}
