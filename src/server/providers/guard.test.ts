import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getDeps, resetDepsForTests } from "../deps.ts";
import { resetEnvForTests } from "../env.ts";
import { PRODUCTION_DB_NAME, isMockForbidden, targetsProductionDb } from "./guard.ts";

const KEYS = ["VERCEL_ENV", "NODE_ENV", "ALLOW_MOCKS_IN_PROD_BUILD", "MONGODB_URI", "MONGODB_DB"];

function setEnv(vars: Record<string, string>) {
  for (const k of KEYS) delete process.env[k];
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

describe("isMockForbidden database isolation", () => {
  it("names the production database aarvion_prod", () => {
    expect(PRODUCTION_DB_NAME).toBe("aarvion_prod");
  });
  it("is false for a non-production database outside production", () => {
    setEnv({ MONGODB_DB: "aarvion_preview" });
    expect(isMockForbidden()).toBe(false);
  });
  it("refuses when MONGODB_DB is aarvion_prod, in any case", () => {
    setEnv({ MONGODB_DB: "aarvion_prod" });
    expect(isMockForbidden()).toBe(true);
    setEnv({ MONGODB_DB: "Aarvion_Prod" });
    expect(isMockForbidden()).toBe(true);
  });
  it("refuses when the URI path database is aarvion_prod (srv, query string)", () => {
    setEnv({
      MONGODB_URI: "mongodb+srv://u:p@cluster0.example.mongodb.net/aarvion_prod?retryWrites=true",
      MONGODB_DB: "aarvion_preview",
    });
    expect(isMockForbidden()).toBe(true);
  });
  it("refuses when the URI path database is aarvion_prod (multi-host)", () => {
    setEnv({ MONGODB_URI: "mongodb://h1:27017,h2:27017/aarvion_prod?replicaSet=rs0" });
    expect(isMockForbidden()).toBe(true);
  });
  it("decodes the URI path and ignores case", () => {
    setEnv({ MONGODB_URI: "mongodb://h/Aarvion%5Fprod" });
    expect(isMockForbidden()).toBe(true);
  });
  it("does not trip on lookalike names or a URI without a path", () => {
    setEnv({
      MONGODB_URI: "mongodb://localhost:27017/?replicaSet=rs0",
      MONGODB_DB: "aarvion_prod2",
    });
    expect(isMockForbidden()).toBe(false);
    expect(
      targetsProductionDb({ MONGODB_URI: "mongodb://h/aarvion_prod_old", MONGODB_DB: "x" }),
    ).toBe(false);
  });
  it("a production build with the override is allowed on a preview db, refused on aarvion_prod", () => {
    setEnv({
      NODE_ENV: "production",
      ALLOW_MOCKS_IN_PROD_BUILD: "1",
      MONGODB_DB: "aarvion_preview",
    });
    expect(isMockForbidden()).toBe(false);
    setEnv({
      NODE_ENV: "production",
      ALLOW_MOCKS_IN_PROD_BUILD: "1",
      MONGODB_DB: "aarvion_prod",
    });
    expect(isMockForbidden()).toBe(true);
  });
  it("getDeps throws when the database is aarvion_prod", () => {
    setEnv({ MONGODB_DB: "aarvion_prod" });
    expect(() => getDeps()).toThrow(/mock providers are not allowed in production/i);
  });
});
