/** Selling price is always MRP minus Rs 20, and is derived, never stored. */
export const MRP_DISCOUNT_PAISE = 2000;
export const MIN_MRP_PAISE = 2100;
/** MRP assumed when a pack's MRP is unknown: Rs 404. */
export const DEFAULT_MRP_PAISE = 40400;

export function sellingPricePaise(mrpPaise: number): number {
  if (!Number.isSafeInteger(mrpPaise) || mrpPaise < MIN_MRP_PAISE) {
    throw new RangeError(`MRP must be a safe integer of at least ${MIN_MRP_PAISE} paise`);
  }
  return mrpPaise - MRP_DISCOUNT_PAISE;
}

/**
 * The "% off" tag: how much of the MRP the Rs 20 discount is, as a whole percent. Floored,
 * never rounded, so the tag can never promise more than the shopper saves (MRP Rs 408 saves
 * 4.9% and shows 4%). Throws like sellingPricePaise for an MRP that cannot carry a price.
 */
export function percentOff(mrpPaise: number): number {
  sellingPricePaise(mrpPaise);
  return Math.floor((MRP_DISCOUNT_PAISE * 100) / mrpPaise);
}

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
