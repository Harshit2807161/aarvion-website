/** Pure order state machine. No DB, no clock: the caller supplies `ctx.at`. */
import { isRxValidOn, type RxSnapshot } from "@/server/prescriptions/validity";

export const ORDER_STATUSES = [
  "pending_payment",
  "placed",
  "confirmed",
  "packed",
  "shipped",
  "delivered",
  "on_hold",
  "cancelled",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export type PaymentMethod = "cod" | "prepaid";
export type PaymentStatus = "pending" | "paid" | "refund_pending" | "refunded";
export type Actor = "customer" | "staff" | "system";

export type OrderForTransition = {
  status: OrderStatus;
  /** The order date. Informational: Rx validity is judged at `ctx.at`, not here. */
  createdAt: Date;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  rx: RxSnapshot;
};

export type OrderEvent =
  | { type: "payment_captured" }
  | { type: "confirm" }
  | { type: "hold"; reason: string }
  | { type: "pack" }
  | { type: "ship"; awb: string; courier: string; trackingUrl?: string }
  | { type: "deliver" }
  | { type: "cancel"; reason: string };

export type TransitionErrorCode =
  "invalid_transition" | "rx_not_valid" | "payment_required" | "awb_required" | "reason_required";

export type StatusHistoryEntry = {
  from: OrderStatus;
  to: OrderStatus;
  at: Date;
  by: Actor;
  reason?: string;
};

export type TransitionResult =
  | { ok: true; to: OrderStatus; entry: StatusHistoryEntry; effects: "refund"[] }
  | { ok: false; error: TransitionErrorCode };

export function initialStatus(method: PaymentMethod): OrderStatus {
  return method === "prepaid" ? "pending_payment" : "placed";
}

/**
 * Allowed edges.
 *
 * Cancel is an edge from pending_payment, placed, on_hold and confirmed. The
 * customer-facing "cancel until packed" window is enforced by actor in the
 * O-phase API, not by this table; staff may need `hold` from confirmed and
 * packed, which is why those two are edges too.
 *
 * Rx rule: `confirm`, `pack` and `ship` judge the Rx currently attached to the
 * order at `ctx.at` only. There is no createdAt check here; order placement (O2)
 * owns that. An Rx that lapsed before dispatch fails `rx_not_valid`; staff then
 * `hold` the order (from placed, confirmed or packed), ask the customer for a new
 * Rx, and `confirm` again from on_hold once a replacement is approved.
 *
 * F16: `hold` and `cancel` on a paid order return a `refund` effect, yet
 * `on_hold -> confirmed` stays an edge (a new Rx is approved). If the caller
 * executes the refund, the prepaid order is `refunded` and `confirm` fails with
 * `payment_required`, so such an order can only leave `on_hold` via `cancel`.
 * It can resume only if a later order phase defers executing the refund while
 * the order is on hold.
 */
export const ORDER_EDGES: Readonly<Record<OrderStatus, readonly OrderStatus[]>> = Object.freeze({
  pending_payment: Object.freeze(["placed", "cancelled"] as const),
  placed: Object.freeze(["confirmed", "on_hold", "cancelled"] as const),
  on_hold: Object.freeze(["confirmed", "cancelled"] as const),
  confirmed: Object.freeze(["packed", "on_hold", "cancelled"] as const),
  packed: Object.freeze(["shipped", "on_hold"] as const),
  shipped: Object.freeze(["delivered"] as const),
  delivered: Object.freeze([] as const),
  cancelled: Object.freeze([] as const),
});

const TARGET: Record<OrderEvent["type"], OrderStatus> = {
  payment_captured: "placed",
  confirm: "confirmed",
  hold: "on_hold",
  pack: "packed",
  ship: "shipped",
  deliver: "delivered",
  cancel: "cancelled",
};

const validReason = (reason: string): boolean => {
  const n = reason.trim().length;
  return n >= 1 && n <= 500;
};

function guard(
  order: Readonly<OrderForTransition>,
  event: OrderEvent,
  at: Date,
): TransitionErrorCode | null {
  switch (event.type) {
    case "confirm":
    case "pack":
    case "ship": {
      if (event.type === "ship" && (!event.awb.trim() || !event.courier.trim())) {
        return "awb_required";
      }
      // Compliance: dispensing happens at dispatch, so an expired Rx cannot
      // authorise it. Judge the Rx currently on the order at the moment of this
      // gated transition (`at`) only.
      if (!isRxValidOn(order.rx, at)) return "rx_not_valid";
      if (event.type === "pack") return null;
      if (order.paymentMethod !== "cod" && order.paymentStatus !== "paid") {
        return "payment_required";
      }
      return null;
    }
    case "hold":
    case "cancel":
      return validReason(event.reason) ? null : "reason_required";
    default:
      return null;
  }
}

export function transition(
  order: Readonly<OrderForTransition>,
  event: OrderEvent,
  ctx: { at: Date; by: Actor },
): TransitionResult {
  const to = TARGET[event.type];
  // Fail closed on a status outside the table (e.g. a legacy value read from the DB).
  const edges = Object.hasOwn(ORDER_EDGES, order.status) ? ORDER_EDGES[order.status] : [];
  if (!edges.includes(to)) return { ok: false, error: "invalid_transition" };

  const error = guard(order, event, ctx.at);
  if (error) return { ok: false, error };

  const entry: StatusHistoryEntry = { from: order.status, to, at: ctx.at, by: ctx.by };
  if (event.type === "hold" || event.type === "cancel") entry.reason = event.reason.trim();

  const refund =
    (event.type === "hold" || event.type === "cancel") && order.paymentStatus === "paid";
  return { ok: true, to, entry, effects: refund ? ["refund"] : [] };
}
