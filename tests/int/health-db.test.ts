import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/health/route";
import { closeMongo } from "@/server/db/client";
import { resetEnvForTests } from "@/server/env";
import { startMemoryReplSet, stopMemoryReplSet } from "../helpers/mongo";

beforeAll(async () => {
  await startMemoryReplSet();
}, 120_000);
afterAll(stopMemoryReplSet);

describe("GET /api/health with a database", () => {
  it("returns 200 db ok when reachable", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    expect((await res.json()).db).toBe("ok");
  });

  it("returns 503 db down within 4s when unreachable", async () => {
    await closeMongo();
    process.env.MONGODB_URI = "mongodb://127.0.0.1:1";
    resetEnvForTests();
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const t = Date.now();
    const res = await GET();
    expect(Date.now() - t).toBeLessThan(4000);
    expect(res.status).toBe(503);
    expect((await res.json()).db).toBe("down");
    expect(errorSpy).toHaveBeenCalled();
    expect(JSON.stringify(errorSpy.mock.calls)).not.toContain("127.0.0.1:1");
    errorSpy.mockRestore();
  }, 10_000);
});
