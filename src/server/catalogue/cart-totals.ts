import { MRP_DISCOUNT_PAISE, sellingPricePaise } from "./pricing.ts";

// Its own module because first-load code imports pricing.ts, and a lazy cart surface that imported
// cartTotals from there would add it to every page's first-load JS (Turbopack keeps one copy of a
// shared module, with every export any chunk uses). Pure and client-safe, like pricing.ts.

export type CartTotals = {
  packs: number;
  mrpPaise: number;
  /** MRP minus payable: the Rs 20 per pack the shopper saves. */
  discountPaise: number;
  /** Always MRP_DISCOUNT_PAISE, so an empty cart can still state it. */
  discountPerPackPaise: number;
  /** Delivery is free. */
  deliveryPaise: 0;
  payablePaise: number;
};

/**
 * Totals for a cart's lines, from each product's current MRP. Payable is the sum of
 * `sellingPricePaise(mrpPaise)` times qty, so it can never disagree with a single line's price.
 * Throws RangeError for an MRP that cannot carry a price (as sellingPricePaise does) or a qty
 * that is not a non-negative integer.
 */
export function cartTotals(items: readonly { mrpPaise: number; qty: number }[]): CartTotals {
  let packs = 0;
  let mrpPaise = 0;
  let payablePaise = 0;
  for (const { mrpPaise: mrp, qty } of items) {
    if (!Number.isSafeInteger(qty) || qty < 0) {
      throw new RangeError("qty must be a non-negative integer");
    }
    payablePaise += sellingPricePaise(mrp) * qty;
    mrpPaise += mrp * qty;
    packs += qty;
  }
  return {
    packs,
    mrpPaise,
    discountPaise: mrpPaise - payablePaise,
    discountPerPackPaise: MRP_DISCOUNT_PAISE,
    deliveryPaise: 0,
    payablePaise,
  };
}
