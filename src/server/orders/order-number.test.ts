import { MongoServerError } from "mongodb";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { formatOrderNumber, nextOrderNumber, orderMonthKey } from "./order-number";

const { findOneAndUpdate, collection } = vi.hoisted(() => {
  const findOneAndUpdate = vi.fn();
  return { findOneAndUpdate, collection: vi.fn(() => ({ findOneAndUpdate })) };
});
vi.mock("@/server/db/client", () => ({ getDb: async () => ({ collection }) }));

const NOV = new Date("2026-11-17T04:30:00Z");
const mongoErr = (code: number) => new MongoServerError({ message: `err ${code}`, code });

describe("orderMonthKey", () => {
  it.each([
    ["last ms of Nov in IST", "2026-11-30T18:29:59.999Z", "2611"],
    ["first ms of Dec in IST", "2026-11-30T18:30:00Z", "2612"],
    ["year rollover in IST", "2026-12-31T18:30:00Z", "2701"],
  ])("%s", (_n, iso, key) => {
    expect(orderMonthKey(new Date(iso))).toBe(key);
  });

  it("throws RangeError for an invalid Date", () => {
    expect(() => orderMonthKey(new Date(Number.NaN))).toThrow(RangeError);
  });

  describe("process TZ independence", () => {
    // Relies on Node re-reading process.env.TZ at runtime (true on current Node).
    const original = process.env.TZ;
    afterEach(() => {
      if (original === undefined) delete process.env.TZ;
      else process.env.TZ = original;
    });

    it.each(["America/Los_Angeles", "Pacific/Kiritimati", "Asia/Kolkata", "UTC"])(
      "gives the IST month under TZ=%s",
      (tz) => {
        process.env.TZ = tz;
        expect(orderMonthKey(new Date("2026-11-30T18:29:59.999Z"))).toBe("2611");
        expect(orderMonthKey(new Date("2026-11-30T18:30:00Z"))).toBe("2612");
        expect(orderMonthKey(new Date("2026-12-31T18:30:00Z"))).toBe("2701");
      },
    );
  });
});

describe("formatOrderNumber", () => {
  it("pads to 5 digits", () => {
    expect(formatOrderNumber("2611", 42)).toBe("AAR-2611-00042");
  });

  it("never truncates beyond 5 digits", () => {
    expect(formatOrderNumber("2611", 100000)).toBe("AAR-2611-100000");
  });

  it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])("rejects seq %s", (seq) => {
    expect(() => formatOrderNumber("2611", seq)).toThrow(RangeError);
  });

  it.each(["", "261", "26111", "26a1", "2611\n", " 2611"])("rejects yymm %j", (yymm) => {
    expect(() => formatOrderNumber(yymm, 1)).toThrow(RangeError);
  });
});

describe("nextOrderNumber E11000 retry", () => {
  beforeEach(() => {
    findOneAndUpdate.mockReset();
    collection.mockClear();
  });

  it("retries once after E11000 and returns the number", async () => {
    findOneAndUpdate
      .mockRejectedValueOnce(mongoErr(11000))
      .mockResolvedValueOnce({ _id: "order-number:2611", seq: 7 });
    await expect(nextOrderNumber(NOV)).resolves.toBe("AAR-2611-00007");
    expect(findOneAndUpdate).toHaveBeenCalledTimes(2);
    expect(collection).toHaveBeenCalledWith("counters");
  });

  it("propagates a second E11000 after exactly 2 calls", async () => {
    const err = mongoErr(11000);
    findOneAndUpdate.mockRejectedValue(err);
    await expect(nextOrderNumber(NOV)).rejects.toBe(err);
    expect(findOneAndUpdate).toHaveBeenCalledTimes(2);
  });

  it("does not retry a non-11000 error", async () => {
    const err = mongoErr(112);
    findOneAndUpdate.mockRejectedValue(err);
    await expect(nextOrderNumber(NOV)).rejects.toBe(err);
    expect(findOneAndUpdate).toHaveBeenCalledTimes(1);
  });
});
