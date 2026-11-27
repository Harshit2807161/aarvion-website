import {
  CART_LIMITS,
  addLine,
  setLineQty,
  type CartBlock,
  type CartLine,
} from "@/server/cart/rules";

/**
 * Pure cart rules for the session-only UI cart (Task 15). The cart holds slugs and quantities
 * only: prices are never computed here, they come from the catalogue when a line is rendered.
 * The limits and the add / set rules live in `src/server/cart/rules.ts`, shared with the server
 * cart; this module keeps the record shape the UI store uses and converts at its boundary.
 * Signed in, the server cart is the truth and this applies the same rules optimistically (`store.ts`).
 */

export { CART_LIMITS };
export type { CartBlock };

/** The old session-only cart key. It is removed on first load and never migrated (pre-launch, no real carts). */
export const CART_UI_STORAGE_KEY = "aarv-cart-ui-v0";
/** sessionStorage key for the guest cart, `{ "lines": [{ "slug", "qty" }] }`. The "v1" is the shape version: bump it, never reinterpret. */
export const CART_GUEST_STORAGE_KEY = "aarv-cart-guest-v1";

/** Packs per product slug. Absent means none; a stored 0 is never kept. */
export type CartLines = Readonly<Record<string, number>>;

export type CartAction =
  | { type: "inc"; slug: string }
  | { type: "dec"; slug: string }
  | { type: "set"; slug: string; qty: number }
  | { type: "remove"; slug: string };

export type CartResult = { lines: CartLines; blocked: CartBlock | null };

export function cartCount(lines: CartLines): number {
  return Object.values(lines).reduce((sum, n) => sum + n, 0);
}

/**
 * Apply one action. A blocked inc returns the same `lines` object it was given, so callers can
 * tell "nothing changed" by identity. Never mutates.
 */
export function applyCart(lines: CartLines, action: CartAction): CartResult {
  // Own keys only: a slug like "constructor" must not reach Object.prototype.
  const have = Object.hasOwn(lines, action.slug) ? lines[action.slug]! : 0;
  const asLines: CartLine[] = Object.entries(lines).map(([slug, qty]) => ({ slug, qty }));
  let change;
  switch (action.type) {
    case "inc":
      change = addLine(asLines, action.slug);
      break;
    case "dec":
      if (have === 0) return { lines, blocked: null };
      change = setLineQty(asLines, action.slug, have - 1);
      break;
    case "set":
      // A quantity the rules would throw on is ignored, like a dec on an absent line.
      if (!Number.isInteger(action.qty) || action.qty < 0 || action.qty > CART_LIMITS.perProduct) {
        return { lines, blocked: null };
      }
      change = setLineQty(asLines, action.slug, action.qty);
      break;
    case "remove":
      change = setLineQty(asLines, action.slug, 0);
      break;
  }
  if (change.lines === asLines) return { lines, blocked: change.blocked };
  return {
    lines: Object.fromEntries(change.lines.map((l) => [l.slug, l.qty])),
    blocked: change.blocked,
  };
}
