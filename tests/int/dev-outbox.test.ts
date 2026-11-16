import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/dev/outbox/route";
import { getDeps, resetDepsForTests } from "@/server/deps";
import "@/server/db/register-all";
import { resetEnvForTests } from "@/server/env";
import { OUTBOX_COLLECTION } from "@/server/providers/outbox";
import { getReq } from "../helpers/http";
import { clearCollections, startMemoryReplSet, stopMemoryReplSet } from "../helpers/mongo";

const PHONE = "+919876543210";

beforeAll(async () => {
  await startMemoryReplSet();
}, 120_000);
afterAll(stopMemoryReplSet);
beforeEach(async () => {
  vi.stubEnv("VERCEL_ENV", "");
  vi.stubEnv("MONGODB_DB", "");
  resetEnvForTests();
  resetDepsForTests();
  await clearCollections(OUTBOX_COLLECTION);
});
afterEach(() => {
  vi.unstubAllEnvs();
  resetEnvForTests();
  resetDepsForTests();
});

describe("GET /dev/outbox", () => {
  it("returns the captured messages oldest first, uncached", async () => {
    await getDeps().sms.send({ to: PHONE, templateId: "otp", vars: { code: "123456" } });
    const res = await GET(getReq(`/dev/outbox?to=${encodeURIComponent(PHONE)}`));
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    const { messages } = await res.json();
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({ channel: "sms", to: PHONE });
    expect(messages[0].payload.vars.code).toBe("123456");
  });

  it("400s without ?to=", async () => {
    const res = await GET(getReq("/dev/outbox"));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "missing_to" });
  });

  it("404s (Next notFound) on VERCEL_ENV=production", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    resetEnvForTests();
    await expect(GET(getReq(`/dev/outbox?to=${encodeURIComponent(PHONE)}`))).rejects.toMatchObject({
      digest: "NEXT_HTTP_ERROR_FALLBACK;404",
    });
  });

  it("404s when the database is aarvion_prod", async () => {
    vi.stubEnv("MONGODB_DB", "aarvion_prod");
    resetEnvForTests();
    await expect(GET(getReq(`/dev/outbox?to=${encodeURIComponent(PHONE)}`))).rejects.toMatchObject({
      digest: "NEXT_HTTP_ERROR_FALLBACK;404",
    });
  });
});
