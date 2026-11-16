import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { getDb } from "@/server/db/client";
import { ensureIndexes, registerIndexes, resetIndexRegistryForTests } from "@/server/db/indexes";
import { startMemoryReplSet, stopMemoryReplSet } from "../helpers/mongo";

beforeAll(async () => {
  await startMemoryReplSet();
}, 120_000);
afterAll(stopMemoryReplSet);

beforeEach(() => {
  resetIndexRegistryForTests();
  registerIndexes("things", [
    { key: { sku: 1 }, name: "sku_1", unique: true },
    { key: { createdAt: -1 }, name: "createdAt_-1" },
  ]);
});

describe("ensureIndexes", () => {
  it("creates indexes once and is a no-op the second time", async () => {
    const db = await getDb();
    const first = await ensureIndexes(db);
    expect(first).toEqual([{ collection: "things", created: ["sku_1", "createdAt_-1"] }]);
    const second = await ensureIndexes(db);
    expect(second).toEqual([{ collection: "things", created: [] }]);
  });

  it("resolves for two concurrent calls", async () => {
    const db = await getDb();
    await db
      .collection("things")
      .dropIndexes()
      .catch(() => {});
    const results = await Promise.all([ensureIndexes(db), ensureIndexes(db)]);
    expect(results).toHaveLength(2);
    const names = (await db.collection("things").indexes()).map((i) => i.name);
    expect(names).toEqual(expect.arrayContaining(["sku_1", "createdAt_-1"]));
  });
});
