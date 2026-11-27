/**
 * Customer-facing cart strings used by the cart line and summary (and the cart page and drawer
 * that mount them). Imported only by those lazy surfaces, never by first-load code.
 *
 * Verbatim from the design prototype (flows.js), except the entries marked NEW, which the brief
 * does not fix and which wait for owner approval like every new customer string.
 */
import { CART_LIMITS } from "@/lib/cart/cart";
import { CART_SENTENCES } from "./cart-sentences";

export const CART_COPY = {
  perProductMax: `Up to ${CART_LIMITS.perProduct} of each per order`,
  perOrderMax: `${CART_LIMITS.perOrder}-pack order limit reached`,
  quantityOf: (name: string) => `Quantity of ${name}`,
  oneFewer: (name: string) => `One fewer ${name}`,
  oneMore: (name: string) => `One more ${name}`,
  removeFrom: (name: string) => `Remove ${name} from cart`,
  remove: "Remove",
  each: "each",
  // Shared with CartControl and CartSync (cart-sentences.ts), so the wording has one source.
  ...CART_SENTENCES,
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
