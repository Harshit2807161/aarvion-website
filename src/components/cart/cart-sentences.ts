import { CART_LIMITS } from "@/lib/cart/cart";

/**
 * The cart sentences spoken by more than one surface: the product-page stepper (`CartControl`),
 * the cart line (`CartLineItem`, through `CART_COPY`) and `CartSync`'s issues. One source, so an
 * owner-approved wording change cannot drift between them. `CartControl` is first-load, so these
 * already ship with every page; keep this module to the shared sentences only.
 */
export const CART_SENTENCES = {
  productLimit: (name: string) => `You can order up to ${CART_LIMITS.perProduct} packs of ${name}.`,
  orderLimit: `An order can hold up to ${CART_LIMITS.perOrder} packs.`,
  inCart: (name: string, qty: number) => `${name}: ${qty} in cart`,
  removed: (name: string) => `${name} removed from cart`,
} as const;
