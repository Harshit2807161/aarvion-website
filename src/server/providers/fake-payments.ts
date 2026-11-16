import { createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import type { PaymentGateway } from "./types.ts";

type Payment = Awaited<ReturnType<PaymentGateway["fetchPayment"]>>;

// Per-process secret: signatures from one process are never valid in another.
const secret = randomBytes(32);

/** Valid signature for the fake gateway; tests use it to simulate a successful checkout. */
export function signFakePayment(orderId: string, paymentId: string): string {
  return createHmac("sha256", secret).update(`${orderId}|${paymentId}`).digest("hex");
}

export type FakeGateway = PaymentGateway & {
  /** Test helper: records a payment against an order and returns it. */
  simulatePayment(i: { orderId: string; amountPaise: number; status?: Payment["status"] }): Payment;
};

export function createFakePayments(): FakeGateway {
  const orders = new Set<string>();
  const payments = new Map<string, Payment>();
  const refunds = new Map<string, string>();

  return {
    async createOrder() {
      const gatewayOrderId = `order_fake_${randomUUID()}`;
      orders.add(gatewayOrderId);
      return { gatewayOrderId };
    },
    async fetchPayment(id) {
      const hit = payments.get(id);
      if (!hit) throw new Error(`Unknown fake payment: ${id}`);
      return hit;
    },
    verifySignature({ orderId, paymentId, signature }) {
      const expected = Buffer.from(signFakePayment(orderId, paymentId));
      const given = Buffer.from(signature);
      return given.length === expected.length && timingSafeEqual(given, expected);
    },
    async refund({ idempotencyKey }) {
      let refundId = refunds.get(idempotencyKey);
      if (!refundId) {
        refundId = `rfnd_fake_${randomUUID()}`;
        refunds.set(idempotencyKey, refundId);
      }
      return { refundId };
    },
    simulatePayment({ orderId, amountPaise, status = "captured" }) {
      if (!orders.has(orderId)) throw new Error(`Unknown fake order: ${orderId}`);
      const payment: Payment = { id: `pay_fake_${randomUUID()}`, orderId, amountPaise, status };
      payments.set(payment.id, payment);
      return payment;
    },
  };
}
