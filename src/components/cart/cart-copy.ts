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
  /** The /cart page: verbatim from the brief and the rulings, except the entries marked NEW. */
  page: {
    title: "Your cart",
    sub: "Each pack is its printed MRP less ₹20. Delivery is free across India.",
    back: "Continue shopping",
    rxHead: "Prescription medicines",
    rxNote:
      "A pharmacist checks your prescription before we pack. At checkout you can upload one, or choose one you’ve uploaded before.",
    // Ruling (plan K): awaiting owner approval; shown only when such a line is in the cart.
    otcHead: "Medicines without a prescription",
    medicines: (n: number) => `${n} ${n === 1 ? "medicine" : "medicines"}`,
    orderFull: `You’ve reached ${CART_LIMITS.perOrder} packs, the most one order can hold. Place this order, then start another.`,
    summaryTitle: "Order summary",
    checkout: "Checkout",
    // Ruling (plan K): the receipt note while online payments are off.
    codNote: "Pay cash on delivery for orders up to ₹5,000.",
    // The prototype's notes, shown only once online payments are live.
    onlineNote:
      "Pay online by UPI, card or netbanking, or pay cash on delivery for orders up to ₹5,000.",
    refundNote: "If a pharmacist can’t approve your prescription, you get a full refund.",
    emptyTitle: "Your cart is empty",
    emptyBody:
      "Find your medicine by brand or salt, then add it here. Every pack is its printed MRP less ₹20.",
    browseAll: (countWord: string) => `Browse all ${countWord} medicines`,
    // NEW (owner approval needed): before the cart is known (the session is still being checked).
    loading: "Loading your cart…",
    // NEW (owner approval needed): a line the server has not priced yet (a quote pending or failing).
    pricePending: "Price updating…",
    // NEW (owner approval needed): the quantity on that line, "Qty 2".
    qty: "Qty",
  },
  /** The cart drawer: verbatim from the design prototype (cart.html's `#cart-drawer`); the title is `page.title`. */
  drawer: {
    close: "Close cart",
    viewCart: "View cart",
    emptyBody: "Find your medicine by brand or salt, then add it here.",
    browse: "Browse medicines",
  },
} as const;
