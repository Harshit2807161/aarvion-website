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
 * The real server cart and the guest merge replace this in phase K.
 */

export { CART_LIMITS };
export type { CartBlock };

/** sessionStorage key for the UI cart. The "v0" is the shape version: bump it, never reinterpret. */
export const CART_UI_STORAGE_KEY = "aarv-cart-ui-v0";

/** Packs per product slug. Absent means none; a stored 0 is never kept. */
export type CartLines = Readonly<Record<string, number>>;

export type CartAction = { type: "inc"; slug: string } | { type: "dec"; slug: string };

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
  if (action.type === "dec" && have === 0) return { lines, blocked: null };
  const asLines: CartLine[] = Object.entries(lines).map(([slug, qty]) => ({ slug, qty }));
  const change =
    action.type === "inc"
      ? addLine(asLines, action.slug)
      : setLineQty(asLines, action.slug, have - 1);
  if (change.lines === asLines) return { lines, blocked: change.blocked };
  return {
    lines: Object.fromEntries(change.lines.map((l) => [l.slug, l.qty])),
    blocked: change.blocked,
  };
}
