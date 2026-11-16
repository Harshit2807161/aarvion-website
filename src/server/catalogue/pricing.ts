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
