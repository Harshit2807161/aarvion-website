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
  /** The order date; Rx validity is judged on this instant. */
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
 * Allowed edges. Cancel is allowed until the order is packed.
 *
 * F16: `hold` and `cancel` on a paid order return a `refund` effect, yet
 * `on_hold -> confirmed` stays an edge (a new Rx is approved). If the caller
 * executes the refund, the prepaid order is `refunded` and `confirm` fails with
 * `payment_required`, so such an order can only leave `on_hold` via `cancel`.
 * It can resume only if a later order phase defers executing the refund while
 * the order is on hold.
 */
export const ORDER_EDGES: Readonly<Record<OrderStatus, readonly OrderStatus[]>> = {
  pending_payment: ["placed", "cancelled"],
  placed: ["confirmed", "on_hold", "cancelled"],
  on_hold: ["confirmed", "cancelled"],
  confirmed: ["packed", "cancelled"],
  packed: ["shipped"],
  shipped: ["delivered"],
  delivered: [],
  cancelled: [],
};

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

function guard(order: Readonly<OrderForTransition>, event: OrderEvent): TransitionErrorCode | null {
  switch (event.type) {
    case "confirm":
    case "ship": {
      if (event.type === "ship" && (!event.awb.trim() || !event.courier.trim())) {
        return "awb_required";
      }
      if (!isRxValidOn(order.rx, order.createdAt)) return "rx_not_valid";
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
  if (!ORDER_EDGES[order.status].includes(to)) return { ok: false, error: "invalid_transition" };

  const error = guard(order, event);
  if (error) return { ok: false, error };

  const entry: StatusHistoryEntry = { from: order.status, to, at: ctx.at, by: ctx.by };
  if (event.type === "hold" || event.type === "cancel") entry.reason = event.reason;

  const refund =
    (event.type === "hold" || event.type === "cancel") && order.paymentStatus === "paid";
  return { ok: true, to, entry, effects: refund ? ["refund"] : [] };
}
