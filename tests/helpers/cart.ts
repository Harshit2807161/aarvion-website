import type { PricedLine } from "../../src/server/cart/service";
import { CART_GUEST_STORAGE_KEY } from "../../src/lib/cart/cart";

/** Puts a guest cart (`{ slug: qty }`) in sessionStorage in the v1 shape, before the store first reads it. */
export function seedGuest(lines: Record<string, number>): void {
  sessionStorage.setItem(
    CART_GUEST_STORAGE_KEY,
    JSON.stringify({ lines: Object.entries(lines).map(([slug, qty]) => ({ slug, qty })) }),
  );
}

/** A priced cart line (the shape of `PricedLine`): Sacuwin 100 at MRP Rs 407 unless overridden. */
export function pricedLine(qty: number, extra: Partial<PricedLine> = {}): PricedLine {
  return {
    slug: "sacuwin-100",
    name: "Sacuwin 100",
    packLabel: "30 tablets",
    dosageForm: "Tablet",
    composition: [
      { ingredient: "Sacubitril (as sodium)", strength: "24 mg" },
      { ingredient: "Valsartan", strength: "26 mg" },
    ],
    rxRequired: true,
    mrpPaise: 40700,
    image: {
      src: "/products/sacuwin-100/cutout-abcdef12.webp",
      width: 400,
      height: 400,
      alt: "Sacuwin 100 pack",
    },
    qty,
    ...extra,
  };
}
