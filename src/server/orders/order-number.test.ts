import { afterEach, describe, expect, it } from "vitest";
import { formatOrderNumber, orderMonthKey } from "./order-number";

describe("orderMonthKey", () => {
  it.each([
    ["last ms of Nov in IST", "2026-11-30T18:29:59.999Z", "2611"],
    ["first ms of Dec in IST", "2026-11-30T18:30:00Z", "2612"],
    ["year rollover in IST", "2026-12-31T18:30:00Z", "2701"],
  ])("%s", (_n, iso, key) => {
    expect(orderMonthKey(new Date(iso))).toBe(key);
  });

  describe("process TZ independence", () => {
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
