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
