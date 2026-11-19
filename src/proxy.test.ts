import { afterEach, describe, expect, it } from "vitest";
import { proxy, config } from "./proxy.ts";
import { resetEnvForTests } from "./server/env.ts";

const saved = { ...process.env };
function setEnv(vars: Record<string, string>) {
  for (const k of [
    "VERCEL_ENV",
    "NODE_ENV",
    "ALLOW_MOCKS_IN_PROD_BUILD",
    "MONGODB_URI",
    "MONGODB_DB",
  ])
    delete process.env[k];
  Object.assign(process.env, { NODE_ENV: "test", ...vars });
  resetEnvForTests();
}
afterEach(() => {
  process.env = { ...saved };
  resetEnvForTests();
});

describe("proxy (dev routes)", () => {
  it("only matches /dev/*", () => {
    expect(config.matcher).toBe("/dev/:path*");
  });

  it("answers 404 for /dev pages when mocks are forbidden (production build)", () => {
    setEnv({ NODE_ENV: "production" });
    const res = proxy();
    expect(res.status).toBe(404);
  });

  it("answers 404 on the production database even in a mock-allowed build", () => {
    setEnv({ NODE_ENV: "production", ALLOW_MOCKS_IN_PROD_BUILD: "1", MONGODB_DB: "aarvion_prod" });
    expect(proxy().status).toBe(404);
  });

  it("lets the request through when mocks are allowed", () => {
    setEnv({});
    const res = proxy();
    expect(res.status).toBe(200);
    expect(res.headers.get("x-middleware-next")).toBe("1");
  });
});
