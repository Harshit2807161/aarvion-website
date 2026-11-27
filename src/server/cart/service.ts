import type { ObjectId } from "mongodb";
import { HttpError } from "../http.ts";
import { getPurchasableBySlugs, type PurchasableProduct } from "../catalogue/queries.ts";
import { cartTotals, type CartTotals } from "../catalogue/pricing.ts";
import { mutateCart, readCart, type CartMutation } from "./carts.ts";
import { addLine, removeLine, setLineQty, type CartBlock, type CartLine } from "./rules.ts";

export type PricedLine = PurchasableProduct & { qty: number };
/**
 * `removed` lists the slugs this call found no longer purchasable. Every function that writes
 * (`getCart` and the changes) deletes them from the stored cart in the same compare-and-set write,
 * so a hidden product never counts toward a cap; `quoteLines` writes nothing and only reports them.
 */
export type CartView = { lines: PricedLine[]; totals: CartTotals; removed: string[] };
export type CartResult =
  | { ok: true; cart: CartView }
  | { ok: false; error: "product_not_found" | CartBlock; cart: CartView };

/** Prices `lines` from `found`; a line whose product is not in `found` is reported in `removed`. */
function viewOf(lines: readonly CartLine[], found: Map<string, PurchasableProduct>): CartView {
  const priced: PricedLine[] = [];
  const removed: string[] = [];
  for (const l of lines) {
    const p = found.get(l.slug);
    if (p) priced.push({ ...p, qty: l.qty });
    else removed.push(l.slug);
  }
  return { lines: priced, totals: cartTotals(priced), removed };
}

async function pricedView(lines: readonly CartLine[]): Promise<CartView> {
  return viewOf(lines, await getPurchasableBySlugs(lines.map((l) => l.slug)));
}

/** The stored slugs of `userId` that can no longer be bought (retired, or in a category that is not live). */
async function retiredSlugs(lines: readonly CartLine[]): Promise<Set<string>> {
  const found = await getPurchasableBySlugs(lines.map((l) => l.slug));
  return new Set(lines.filter((l) => !found.has(l.slug)).map((l) => l.slug));
}

type Rule = (ls: readonly CartLine[]) => CartMutation;

const without = (ls: readonly CartLine[], gone: ReadonlySet<string>) =>
  ls.some((l) => gone.has(l.slug)) ? ls.filter((l) => !gone.has(l.slug)) : ls;

/**
 * The one write path: drops the retired lines first, then applies `rule` to what is left, in a
 * single compare-and-set. A refused or no-op rule still writes the pruned cart when something was
 * pruned, and writes nothing otherwise.
 */
async function change(
  userId: ObjectId,
  now: Date,
  rule: Rule,
): Promise<{ view: CartView; blocked: CartBlock | null; trimmed: boolean }> {
  const gone = await retiredSlugs((await readCart(userId))?.lines ?? []);
  let removed: string[] = [];
  const res = await mutateCart(userId, now, (ls) => {
    const kept = without(ls, gone);
    removed = ls.filter((l) => gone.has(l.slug)).map((l) => l.slug);
    return rule(kept);
  });
  return {
    view: { ...(await pricedView(res.lines)), removed },
    blocked: res.blocked,
    trimmed: res.trimmed,
  };
}

async function result(userId: ObjectId, now: Date, rule: Rule): Promise<CartResult> {
  const { view, blocked } = await change(userId, now, rule);
  return blocked ? { ok: false, error: blocked, cart: view } : { ok: true, cart: view };
}

/**
 * The cart with every line repriced from Mongo; retired lines are deleted in the same write. A
 * read that finds retired lines therefore writes, and can lose races: after 409 `cart_conflict` it
 * falls back to the unpruned view (the lines still listed in `removed`), which is correct to show.
 */
export async function getCart(userId: ObjectId, now: Date): Promise<CartView> {
  const lines = (await readCart(userId))?.lines ?? [];
  const found = await getPurchasableBySlugs(lines.map((l) => l.slug));
  const view = viewOf(lines, found);
  if (view.removed.length === 0) return view;
  try {
    return (await change(userId, now, (ls) => ({ lines: ls }))).view;
  } catch (err) {
    if (err instanceof HttpError && err.status === 409) return view;
    throw err;
  }
}

async function notFound(userId: ObjectId, now: Date): Promise<CartResult> {
  return { ok: false, error: "product_not_found", cart: await getCart(userId, now) };
}

/** Adds `n` packs (1 to 10). An unknown or retired product is `product_not_found`, no write for it. */
export async function addToCart(
  userId: ObjectId,
  slug: string,
  n: number,
  now: Date,
): Promise<CartResult> {
  if (!(await getPurchasableBySlugs([slug])).has(slug)) return notFound(userId, now);
  return result(userId, now, (ls) => addLine(ls, slug, n));
}

/** Sets a line to `qty` (0 to 10). Removing (0) needs no purchasability: a retired line must go. */
export async function setCartQty(
  userId: ObjectId,
  slug: string,
  qty: number,
  now: Date,
): Promise<CartResult> {
  if (qty > 0 && !(await getPurchasableBySlugs([slug])).has(slug)) return notFound(userId, now);
  return result(userId, now, (ls) => setLineQty(ls, slug, qty));
}

/** Removes a line; an absent slug is a successful no-op. */
export async function removeFromCart(
  userId: ObjectId,
  slug: string,
  now: Date,
): Promise<CartResult> {
  return result(userId, now, (ls) => removeLine(ls, slug));
}
