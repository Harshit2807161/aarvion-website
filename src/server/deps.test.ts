import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resetEnvForTests } from "./env.ts";
import { readOutbox } from "./providers/outbox.ts";
import { getDeps, resetDepsForTests, setDepsForTests } from "./deps.ts";
import { createFakePayments, signFakePayment } from "./providers/fake-payments.ts";
import { createMemoryFiles } from "./providers/memory-files.ts";

function setEnv(vars: Record<string, string>) {
  for (const k of [
    "VERCEL_ENV",
    "NODE_ENV",
    "ALLOW_MOCKS_IN_PROD_BUILD",
    "SMS_PROVIDER",
    "EMAIL_PROVIDER",
    "PAYMENTS_PROVIDER",
    "FILE_STORE",
  ]) {
    delete process.env[k];
  }
  Object.assign(process.env, { NODE_ENV: "test", ...vars });
  resetEnvForTests();
  resetDepsForTests();
}

const saved = { ...process.env };
beforeEach(() => setEnv({}));
afterEach(() => {
  process.env = { ...saved };
  resetEnvForTests();
  resetDepsForTests();
});

describe("getDeps guard", () => {
  it("builds mocks by default outside production", () => {
    expect(getDeps().payments).toBeDefined();
  });
  it("throws for mocks when VERCEL_ENV=production", () => {
    setEnv({ VERCEL_ENV: "production" });
    expect(() => getDeps()).toThrow(/mock providers are not allowed in production/i);
  });
  it("throws for mocks in a production NODE_ENV build without the override", () => {
    setEnv({ NODE_ENV: "production" });
    expect(() => getDeps()).toThrow(/mock providers are not allowed in production/i);
  });
  it("allows mocks in a production build with ALLOW_MOCKS_IN_PROD_BUILD=1", () => {
    setEnv({ NODE_ENV: "production", ALLOW_MOCKS_IN_PROD_BUILD: "1" });
    expect(() => getDeps()).not.toThrow();
  });
  it("still refuses mocks on VERCEL_ENV=production despite the override", () => {
    setEnv({ VERCEL_ENV: "production", NODE_ENV: "production", ALLOW_MOCKS_IN_PROD_BUILD: "1" });
    expect(() => getDeps()).toThrow(/mock providers are not allowed in production/i);
  });
  it("readOutbox throws in production", async () => {
    setEnv({ VERCEL_ENV: "production" });
    await expect(readOutbox("+919876543210")).rejects.toThrow(/not available in production/);
  });
  it("setDepsForTests overrides a provider", () => {
    setDepsForTests({ now: () => new Date(0) });
    expect(getDeps().now().getTime()).toBe(0);
  });
  it.each([
    ["SMS_PROVIDER", "msg91"],
    ["EMAIL_PROVIDER", "resend"],
    ["PAYMENTS_PROVIDER", "razorpay"],
    ["FILE_STORE", "blob"],
    ["FILE_STORE", "local"],
  ])("throws not implemented for %s=%s", (k, v) => {
    setEnv({ [k]: v });
    expect(() => getDeps()).toThrow(/not implemented yet/);
  });
});

describe("fake payment gateway", () => {
  it("verifies only its own HMAC", () => {
    const gw = createFakePayments();
    const good = signFakePayment("order_1", "pay_1");
    expect(gw.verifySignature({ orderId: "order_1", paymentId: "pay_1", signature: good })).toBe(
      true,
    );
    expect(gw.verifySignature({ orderId: "order_1", paymentId: "pay_2", signature: good })).toBe(
      false,
    );
    expect(gw.verifySignature({ orderId: "order_1", paymentId: "pay_1", signature: "short" })).toBe(
      false,
    );
    expect(
      gw.verifySignature({ orderId: "order_1", paymentId: "pay_1", signature: "0".repeat(64) }),
    ).toBe(false);
  });
  it("creates orders, fetches simulated payments and refunds idempotently", async () => {
    const gw = createFakePayments();
    const { gatewayOrderId } = await gw.createOrder({ amountPaise: 5000, receipt: "r1" });
    const pay = gw.simulatePayment({ orderId: gatewayOrderId, amountPaise: 5000 });
    expect(await gw.fetchPayment(pay.id)).toMatchObject({
      status: "captured",
      orderId: gatewayOrderId,
    });
    const a = await gw.refund({ paymentId: pay.id, amountPaise: 5000, idempotencyKey: "k" });
    const b = await gw.refund({ paymentId: pay.id, amountPaise: 5000, idempotencyKey: "k" });
    expect(a).toEqual(b);
  });
});

describe("memory file store", () => {
  it("round-trips and deletes", async () => {
    const f = createMemoryFiles();
    await f.put("a/b.txt", new Uint8Array([1, 2]), "text/plain");
    expect(await f.get("a/b.txt")).toEqual({
      body: new Uint8Array([1, 2]),
      contentType: "text/plain",
    });
    await f.delete("a/b.txt");
    expect(await f.get("a/b.txt")).toBeNull();
  });
});
