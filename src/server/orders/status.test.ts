import { describe, expect, it } from "vitest";
import {
  ORDER_EDGES,
  ORDER_STATUSES,
  initialStatus,
  transition,
  type OrderEvent,
  type OrderForTransition,
  type OrderStatus,
} from "./status";

const d = (s: string) => new Date(s);
const at = d("2026-11-16T07:00:00Z");
const ctx = { at, by: "staff" } as const;

const happy = (status: OrderStatus): OrderForTransition => ({
  status,
  createdAt: d("2026-11-16T06:00:00Z"),
  paymentMethod: "prepaid",
  paymentStatus: "paid",
  rx: { status: "approved", rxDate: d("2026-11-01T18:30:00Z"), validUntil: null },
});

const EVENT_FOR: Partial<Record<OrderStatus, OrderEvent>> = {
  placed: { type: "payment_captured" },
  confirmed: { type: "confirm" },
  on_hold: { type: "hold", reason: "Rx unreadable" },
  packed: { type: "pack" },
  shipped: { type: "ship", awb: "AWB123", courier: "Delhivery" },
  delivered: { type: "deliver" },
  cancelled: { type: "cancel", reason: "Ordered by mistake" },
};

describe("ORDER_EDGES", () => {
  it("matches the spec table exactly", () => {
    expect(ORDER_EDGES).toEqual({
      pending_payment: ["placed", "cancelled"],
      placed: ["confirmed", "on_hold", "cancelled"],
      on_hold: ["confirmed", "cancelled"],
      confirmed: ["packed", "cancelled"],
      packed: ["shipped"],
      shipped: ["delivered"],
      delivered: [],
      cancelled: [],
    });
  });

  it("lists the 8 statuses", () => {
    expect([...ORDER_STATUSES]).toEqual([
      "pending_payment",
      "placed",
      "confirmed",
      "packed",
      "shipped",
      "delivered",
      "on_hold",
      "cancelled",
    ]);
  });
});

describe("all 64 from/to pairs", () => {
  const pairs = ORDER_STATUSES.flatMap((from) => ORDER_STATUSES.map((to) => [from, to] as const));
  it.each(pairs)("%s -> %s", (from, to) => {
    const allowed = ORDER_EDGES[from].includes(to);
    const event = EVENT_FOR[to];
    if (!event) {
      // pending_payment is only ever an initial status.
      expect(to).toBe("pending_payment");
      expect(allowed).toBe(false);
      return;
    }
    const r = transition(happy(from), event, ctx);
    expect(r.ok).toBe(allowed);
    if (r.ok) expect(r.to).toBe(to);
    else expect(r.error).toBe("invalid_transition");
  });
});

describe("initialStatus", () => {
  it("maps payment method", () => {
    expect(initialStatus("prepaid")).toBe("pending_payment");
    expect(initialStatus("cod")).toBe("placed");
  });
});

describe("confirm guards", () => {
  const confirm: OrderEvent = { type: "confirm" };
  it("rejects a pending Rx", () => {
    const o = { ...happy("placed"), rx: { ...happy("placed").rx, status: "pending" as const } };
    expect(transition(o, confirm, ctx)).toEqual({ ok: false, error: "rx_not_valid" });
  });
  it("rejects an Rx older than 6 months on the order date", () => {
    const o = {
      ...happy("placed"),
      rx: { status: "approved" as const, rxDate: d("2026-04-30T18:30:00Z"), validUntil: null },
    };
    expect(transition(o, confirm, ctx)).toEqual({ ok: false, error: "rx_not_valid" });
  });
  it("judges validity on the order date, not ctx.at", () => {
    const o = {
      ...happy("placed"),
      createdAt: d("2026-11-10T06:00:00Z"),
      rx: {
        status: "approved" as const,
        rxDate: d("2026-11-01T18:30:00Z"),
        validUntil: d("2026-11-12T00:00:00Z"),
      },
    };
    expect(transition(o, confirm, { at: d("2026-11-20T06:00:00Z"), by: "staff" }).ok).toBe(true);
  });
  it("allows COD with pending payment", () => {
    const o = {
      ...happy("placed"),
      paymentMethod: "cod" as const,
      paymentStatus: "pending" as const,
    };
    expect(transition(o, confirm, ctx).ok).toBe(true);
  });
  it("on_hold prepaid refunded needs payment (F16)", () => {
    const o = { ...happy("on_hold"), paymentStatus: "refunded" as const };
    expect(transition(o, confirm, ctx)).toEqual({ ok: false, error: "payment_required" });
  });
  it("prepaid unpaid needs payment", () => {
    const o = { ...happy("placed"), paymentStatus: "pending" as const };
    expect(transition(o, confirm, ctx)).toEqual({ ok: false, error: "payment_required" });
  });
  it("reports rx_not_valid before payment_required", () => {
    const o = {
      ...happy("placed"),
      paymentStatus: "pending" as const,
      rx: { ...happy("placed").rx, status: "rejected" as const },
    };
    expect(transition(o, confirm, ctx)).toEqual({ ok: false, error: "rx_not_valid" });
  });
});

describe("ship guards", () => {
  const ship = (over: Partial<Extract<OrderEvent, { type: "ship" }>> = {}): OrderEvent => ({
    type: "ship",
    awb: "AWB123",
    courier: "Delhivery",
    ...over,
  });
  it.each([
    ["empty awb", { awb: "" }],
    ["blank awb", { awb: "  " }],
    ["empty courier", { courier: "" }],
    ["blank courier", { courier: "  " }],
  ])("%s -> awb_required", (_n, over) => {
    expect(transition(happy("packed"), ship(over), ctx)).toEqual({
      ok: false,
      error: "awb_required",
    });
  });
  it("re-checks the Rx", () => {
    const o = { ...happy("packed"), rx: { ...happy("packed").rx, status: "rejected" as const } };
    expect(transition(o, ship(), ctx)).toEqual({ ok: false, error: "rx_not_valid" });
  });
  it("re-checks payment", () => {
    const o = { ...happy("packed"), paymentStatus: "refunded" as const };
    expect(transition(o, ship(), ctx)).toEqual({ ok: false, error: "payment_required" });
  });
  it("accepts an optional trackingUrl", () => {
    expect(transition(happy("packed"), ship({ trackingUrl: "https://t.example/1" }), ctx).ok).toBe(
      true,
    );
  });
});

describe("reason guards", () => {
  it.each(["hold", "cancel"] as const)("%s needs a 1..500 char reason", (type) => {
    for (const reason of ["", "   ", "x".repeat(501)]) {
      expect(transition(happy("placed"), { type, reason }, ctx)).toEqual({
        ok: false,
        error: "reason_required",
      });
    }
    expect(transition(happy("placed"), { type, reason: "x".repeat(500) }, ctx).ok).toBe(true);
  });
  it("checks the edge before the reason", () => {
    expect(transition(happy("shipped"), { type: "cancel", reason: "" }, ctx)).toEqual({
      ok: false,
      error: "invalid_transition",
    });
  });
});

describe("refund effects (F16)", () => {
  it("hold on a paid prepaid order refunds", () => {
    const r = transition(happy("placed"), { type: "hold", reason: "Rx unreadable" }, ctx);
    expect(r.ok && r.effects).toEqual(["refund"]);
  });
  it("cancel from confirmed, paid refunds", () => {
    const r = transition(happy("confirmed"), { type: "cancel", reason: "x" }, ctx);
    expect(r.ok && r.effects).toEqual(["refund"]);
  });
  it("cancel of COD has no effects", () => {
    const o = {
      ...happy("placed"),
      paymentMethod: "cod" as const,
      paymentStatus: "pending" as const,
    };
    const r = transition(o, { type: "cancel", reason: "x" }, ctx);
    expect(r.ok && r.effects).toEqual([]);
  });
  it("cancel from pending_payment has no effects", () => {
    const o = { ...happy("pending_payment"), paymentStatus: "pending" as const };
    const r = transition(o, { type: "cancel", reason: "x" }, ctx);
    expect(r.ok && r.effects).toEqual([]);
  });
  it("non-refunding transitions have no effects", () => {
    const r = transition(happy("placed"), { type: "confirm" }, ctx);
    expect(r.ok && r.effects).toEqual([]);
  });
});

describe("history entry and purity", () => {
  it("records the cancel entry", () => {
    const r = transition(
      happy("placed"),
      { type: "cancel", reason: "Ordered by mistake" },
      { at, by: "customer" },
    );
    expect(r.ok && r.entry).toEqual({
      from: "placed",
      to: "cancelled",
      at,
      by: "customer",
      reason: "Ordered by mistake",
    });
  });
  it("omits reason for events without one", () => {
    const r = transition(happy("placed"), { type: "confirm" }, ctx);
    expect(r.ok && "reason" in r.entry).toBe(false);
  });
  it("does not mutate a deep-frozen order", () => {
    const o = happy("placed");
    Object.freeze(o);
    Object.freeze(o.rx);
    Object.freeze(o.createdAt);
    expect(() => transition(o, { type: "confirm" }, ctx)).not.toThrow();
    expect(o.status).toBe("placed");
  });
});

describe("Rx validity is judged on order.createdAt, never on now", () => {
  // Rx dated 1 May 2026 IST expires 1 Nov 2026 IST (exclusive).
  const rxMay = {
    status: "approved" as const,
    rxDate: d("2026-04-30T18:30:00Z"),
    validUntil: null,
  };
  it("confirm succeeds when the Rx was valid at creation but is expired today", () => {
    const o = { ...happy("placed"), createdAt: d("2026-10-20T06:00:00Z"), rx: rxMay };
    const today = { at: d("2026-11-16T06:00:00Z"), by: "staff" } as const;
    expect(transition(o, { type: "confirm" }, today).ok).toBe(true);
  });
  it("ship succeeds when the Rx was valid at creation but is expired today", () => {
    const o = { ...happy("packed"), createdAt: d("2026-10-20T06:00:00Z"), rx: rxMay };
    const today = { at: d("2026-11-16T06:00:00Z"), by: "staff" } as const;
    expect(transition(o, { type: "ship", awb: "A1", courier: "C" }, today).ok).toBe(true);
  });
  it("confirm fails when the Rx had already expired at creation, even if ctx.at is earlier", () => {
    const o = { ...happy("placed"), createdAt: d("2026-11-16T06:00:00Z"), rx: rxMay };
    const earlier = { at: d("2026-10-01T06:00:00Z"), by: "staff" } as const;
    expect(transition(o, { type: "confirm" }, earlier)).toEqual({
      ok: false,
      error: "rx_not_valid",
    });
  });
});
