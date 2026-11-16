import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { getDb } from "@/server/db/client";
import { COUNTERS_COLLECTION, nextOrderNumber } from "@/server/orders/order-number";
import { clearCollections, startMemoryReplSet, stopMemoryReplSet } from "../helpers/mongo";

beforeAll(async () => {
  await startMemoryReplSet();
}, 120_000);
afterAll(stopMemoryReplSet);
beforeEach(async () => {
  await clearCollections(COUNTERS_COLLECTION);
});

const NOV = new Date("2026-11-17T04:30:00Z");

describe("nextOrderNumber", () => {
  it("starts a month at 00001", async () => {
    expect(await nextOrderNumber(NOV)).toBe("AAR-2611-00001");
    expect(await nextOrderNumber(NOV)).toBe("AAR-2611-00002");
  });

  it("hands out 50 distinct numbers to 50 parallel first calls", async () => {
    const numbers = await Promise.all(Array.from({ length: 50 }, () => nextOrderNumber(NOV)));
    expect(new Set(numbers).size).toBe(50);
    const seqs = numbers.map((n) => Number(n.split("-")[2])).sort((a, b) => a - b);
    expect(seqs).toEqual(Array.from({ length: 50 }, (_, i) => i + 1));
  });

  it("starts a new IST month at 00001 and leaves the old counter alone", async () => {
    await nextOrderNumber(NOV);
    await nextOrderNumber(NOV);
    expect(await nextOrderNumber(new Date("2026-11-30T18:30:00Z"))).toBe("AAR-2612-00001");
    const col = (await getDb()).collection<{ _id: string; seq: number }>(COUNTERS_COLLECTION);
    expect(await col.findOne({ _id: "order-number:2611" })).toEqual({
      _id: "order-number:2611",
      seq: 2,
    });
  });
});
