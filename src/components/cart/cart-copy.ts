/**
 * Customer-facing cart strings used by the cart line and summary (and the cart page and drawer
 * that mount them). Imported only by those lazy surfaces, never by first-load code.
 *
 * Verbatim from the design prototype (flows.js), except the entries marked NEW, which the brief
 * does not fix and which wait for owner approval like every new customer string.
 */
export const CART_COPY = {
  summary: {
    mrpTotal: "MRP total",
    discount: "Aarvion discount",
    delivery: "Delivery",
    free: "Free",
    payable: "Total payable",
    tax: "Inclusive of all taxes",
    mrp: "MRP",
    less: "less",
    freeDelivery: "Free delivery",
    pack: "pack",
    packs: "packs",
    // NEW (owner approval needed): said beside the totals instead of letting stale ones pass as current.
    updating: "Updating totals…",
  },
} as const;
