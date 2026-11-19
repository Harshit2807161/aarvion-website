/**
 * Pure cart rules for the session-only UI cart (Task 15). The cart holds slugs and quantities
 * only: prices are never computed here, they come from the catalogue when a line is rendered.
 * The real server cart and the guest merge replace this in phase K.
 */

export const CART_LIMITS = { perProduct: 10, perOrder: 20 } as const;

/** sessionStorage key for the UI cart. The "v0" is the shape version: bump it, never reinterpret. */
export const CART_UI_STORAGE_KEY = "aarv-cart-ui-v0";

/** Packs per product slug. Absent means none; a stored 0 is never kept. */
export type CartLines = Readonly<Record<string, number>>;

export type CartAction = { type: "inc"; slug: string } | { type: "dec"; slug: string };

export type CartBlock = "product_limit" | "order_limit";

export type CartResult = { lines: CartLines; blocked: CartBlock | null };

export function cartCount(lines: CartLines): number {
  return Object.values(lines).reduce((sum, n) => sum + n, 0);
}

/**
 * Apply one action. A blocked inc returns the same `lines` object it was given, so callers can
 * tell "nothing changed" by identity. Never mutates.
 */
export function applyCart(lines: CartLines, action: CartAction): CartResult {
  const have = lines[action.slug] ?? 0;
  if (action.type === "inc") {
    if (have >= CART_LIMITS.perProduct) return { lines, blocked: "product_limit" };
    if (cartCount(lines) >= CART_LIMITS.perOrder) return { lines, blocked: "order_limit" };
    return { lines: { ...lines, [action.slug]: have + 1 }, blocked: null };
  }
  if (have === 0) return { lines, blocked: null };
  const next = { ...lines, [action.slug]: have - 1 };
  if (have === 1) delete next[action.slug];
  return { lines: next, blocked: null };
}
