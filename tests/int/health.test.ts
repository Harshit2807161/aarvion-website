import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/health/route";
import { resetEnvForTests } from "@/server/env";

beforeEach(() => {
  vi.stubEnv("MONGODB_URI", "");
  vi.stubEnv("VERCEL_ENV", "");
  vi.stubEnv("ALLOW_MOCKS_IN_PROD_BUILD", "");
  resetEnvForTests();
});
afterEach(() => {
  vi.unstubAllEnvs();
  resetEnvForTests();
});

describe("GET /api/health without a database", () => {
  it("returns 200 with status ok and db skipped outside production", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.status).toBe("ok");
    expect(json.db).toBe("skipped");
    expect(typeof json.version).toBe("string");
  });

  it("returns 503 db unconfigured on Vercel production", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    resetEnvForTests();
    const res = await GET();
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ status: "error", db: "unconfigured" });
  });

  it("returns 503 db unconfigured for a production build", async () => {
    vi.stubEnv("NODE_ENV", "production");
    resetEnvForTests();
    const res = await GET();
    expect(res.status).toBe(503);
    expect((await res.json()).db).toBe("unconfigured");
  });

  it("stays 200 skipped for the e2e production build (mocks allowed)", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ALLOW_MOCKS_IN_PROD_BUILD", "1");
    resetEnvForTests();
    const res = await GET();
    expect(res.status).toBe(200);
    expect((await res.json()).db).toBe("skipped");
  });

  it("returns 503 misconfigured on invalid env without leaking values", async () => {
    vi.stubEnv("VERCEL_ENV", "super-secret-value");
    resetEnvForTests();
    const res = await GET();
    expect(res.status).toBe(503);
    const text = await res.text();
    expect(JSON.parse(text)).toMatchObject({ status: "error", db: "misconfigured" });
    expect(text).not.toContain("super-secret-value");
    expect(text).not.toContain("VERCEL_ENV");
  });
});
