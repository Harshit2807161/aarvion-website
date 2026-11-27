import { CART_GUEST_STORAGE_KEY } from "../../src/lib/cart/cart";

/** Puts a guest cart (`{ slug: qty }`) in sessionStorage in the v1 shape, before the store first reads it. */
export function seedGuest(lines: Record<string, number>): void {
  sessionStorage.setItem(
    CART_GUEST_STORAGE_KEY,
    JSON.stringify({ lines: Object.entries(lines).map(([slug, qty]) => ({ slug, qty })) }),
  );
}
