import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { EnvError, getEnv, resetEnvForTests } from "./env.ts";
import { createFileStore } from "./providers/file-store.ts";
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
    "FILE_STORE_LOCAL_DIR",
    "MONGODB_DB",
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
  ])("throws not implemented for %s=%s", (k, v) => {
    setEnv({ [k]: v });
    expect(() => getDeps()).toThrow(/not implemented yet/);
  });
});

describe("file store wiring", () => {
  it("builds the memory store by default outside production", async () => {
    const files = getDeps().files;
    expect(files.kind).toBe("memory");
    await files.put("rx/u/a.webp", new Uint8Array([1]), "image/webp");
    expect((await files.get("rx/u/a.webp"))?.body).toEqual(new Uint8Array([1]));
  });
  it("keeps one store per process, so a put is visible to a later getDeps()", async () => {
    await getDeps().files.put("rx/u/b.webp", new Uint8Array([2]), "image/webp");
    expect(await getDeps().files.get("rx/u/b.webp")).not.toBeNull();
  });
  it("builds the local store for FILE_STORE=local", () => {
    setEnv({ FILE_STORE: "local", FILE_STORE_LOCAL_DIR: ".data/test-files" });
    expect(getDeps().files.kind).toBe("local");
  });
  it.each(["local", "memory"])(
    "on Vercel (VERCEL_ENV=preview), FILE_STORE=%s leaves the other providers working and fails only file access",
    async (store) => {
      setEnv({ FILE_STORE: store, VERCEL_ENV: "preview", ALLOW_MOCKS_IN_PROD_BUILD: "1" });
      expect(() => getDeps().now()).not.toThrow();
      expect(getDeps().sms).toBeDefined();
      const err = await getDeps()
        .files.put("rx/u/a.webp", new Uint8Array(1), "image/webp")
        .catch((e: unknown) => e);
      expect(err).toBeInstanceOf(EnvError);
      expect((err as Error).message).toBe(
        `FILE_STORE=${store} does not persist across Vercel functions: use blob`,
      );
    },
  );
  it.each([
    ["local", { MONGODB_DB: "aarvion_prod" }],
    ["memory", { MONGODB_DB: "aarvion_prod" }],
    ["local", { NODE_ENV: "production" }],
  ])("refuses FILE_STORE=%s on first use where mocks are forbidden (%o)", async (store, extra) => {
    setEnv({ FILE_STORE: store, ...extra });
    const err = await createFileStore(getEnv())
      .get("rx/u/a.webp")
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(EnvError);
    expect((err as Error).message).toMatch(/not allowed in production/);
  });
  it("still throws not implemented for FILE_STORE=blob, on first file use only", async () => {
    setEnv({ FILE_STORE: "blob" });
    const files = getDeps().files;
    expect(files.kind).toBe("blob");
    await expect(files.delete("rx/u/a.webp")).rejects.toThrow(
      /FILE_STORE=blob: not implemented yet/,
    );
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
    await f.put("rx/u/b.webp", new Uint8Array([1, 2]), "image/webp");
    expect(await f.get("rx/u/b.webp")).toEqual({
      body: new Uint8Array([1, 2]),
      contentType: "image/webp",
    });
    await f.delete("rx/u/b.webp");
    expect(await f.get("rx/u/b.webp")).toBeNull();
  });
});
