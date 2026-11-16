import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const connect = vi.fn();
const close = vi.fn(async () => {});
const ctor = vi.fn();

vi.mock("mongodb", () => ({
  MongoClient: class {
    constructor(...args: unknown[]) {
      ctor(...args);
    }
    connect = connect;
    close = close;
    db = vi.fn(() => ({ name: "fake" }));
  },
}));

describe("getMongoClient", () => {
  beforeEach(async () => {
    vi.resetModules();
    vi.unstubAllEnvs();
    vi.stubEnv("MONGODB_URI", "mongodb://127.0.0.1:27017");
    connect.mockReset();
    close.mockClear();
    ctor.mockClear();
    delete globalThis.__aarvionMongo;
    const { resetEnvForTests } = await import("../env.ts");
    resetEnvForTests();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    delete globalThis.__aarvionMongo;
  });

  it("returns the same promise twice and connects once", async () => {
    connect.mockImplementation(async function (this: unknown) {
      return this;
    });
    const { getMongoClient } = await import("./client");
    const a = getMongoClient();
    const b = getMongoClient();
    expect(a).toBe(b);
    await a;
    expect(connect).toHaveBeenCalledTimes(1);
    expect(ctor.mock.calls[0]?.[1]).toMatchObject({
      serverSelectionTimeoutMS: 3000,
      maxPoolSize: 10,
      maxIdleTimeMS: 5000,
    });
  });

  it("creates a new client after a rejected connect", async () => {
    connect.mockRejectedValueOnce(new Error("boom"));
    connect.mockImplementation(async function (this: unknown) {
      return this;
    });
    const { getMongoClient } = await import("./client");
    await expect(getMongoClient()).rejects.toThrow("boom");
    await expect(getMongoClient()).resolves.toBeDefined();
    expect(ctor).toHaveBeenCalledTimes(2);
  });

  it("throws when MONGODB_URI is unset", async () => {
    vi.stubEnv("MONGODB_URI", "");
    const { resetEnvForTests } = await import("../env.ts");
    resetEnvForTests();
    const { getMongoClient } = await import("./client");
    await expect(getMongoClient()).rejects.toThrow(/MONGODB_URI/);
  });
});
