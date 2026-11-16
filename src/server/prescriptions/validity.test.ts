import { describe, expect, it } from "vitest";
import { RX_VALIDITY_MONTHS, addCalendarMonthsIst, isRxValidOn, type RxSnapshot } from "./validity";

const d = (s: string) => new Date(s);

describe("addCalendarMonthsIst", () => {
  it("exposes a 6 month validity", () => {
    expect(RX_VALIDITY_MONTHS).toBe(6);
  });

  it.each([
    ["plain month add", "2026-05-16T18:30:00Z", 6, "2026-11-16T18:30:00Z"],
    ["31 Aug IST clamps to 28 Feb", "2026-08-30T18:30:00Z", 6, "2027-02-27T18:30:00Z"],
    ["31 Aug IST clamps to 29 Feb (leap)", "2027-08-30T18:30:00Z", 6, "2028-02-28T18:30:00Z"],
    ["crosses a year boundary", "2026-11-14T18:30:00Z", 6, "2027-05-14T18:30:00Z"],
    ["zero months is identity", "2026-05-16T18:30:00Z", 0, "2026-05-16T18:30:00Z"],
  ])("%s", (_n, from, months, to) => {
    expect(addCalendarMonthsIst(d(from), months).toISOString()).toBe(d(to).toISOString());
  });

  it("uses the IST wall clock: 23:59 UTC on 30 Aug is already 31 Aug IST", () => {
    // 2026-08-30T23:59Z = 2026-08-31 05:29 IST -> 2027-02-28 05:29 IST = 2027-02-27T23:59Z
    expect(addCalendarMonthsIst(d("2026-08-30T23:59:00Z"), 6).toISOString()).toBe(
      "2027-02-27T23:59:00.000Z",
    );
  });

  it("uses the IST wall clock: 18:29 UTC on 30 Aug is still 30 Aug IST", () => {
    // 2026-08-30T18:29Z = 2026-08-30 23:59 IST -> 2027-02-28 23:59 IST (clamped from 30)
    expect(addCalendarMonthsIst(d("2026-08-30T18:29:00Z"), 6).toISOString()).toBe(
      "2027-02-28T18:29:00.000Z",
    );
  });

  it("handles a 29 Feb leap start", () => {
    // 2028-02-29 00:00 IST + 12 months -> 2029-02-28 (clamped)
    expect(addCalendarMonthsIst(d("2028-02-28T18:30:00Z"), 12).toISOString()).toBe(
      "2029-02-27T18:30:00.000Z",
    );
  });
});

const rx = (over: Partial<RxSnapshot> = {}): RxSnapshot => ({
  status: "approved",
  rxDate: d("2026-05-16T18:30:00Z"),
  validUntil: null,
  ...over,
});

describe("isRxValidOn", () => {
  it("is valid just before the 6 month exclusive end and invalid at it", () => {
    expect(isRxValidOn(rx(), d("2026-11-16T18:29:59.999Z"))).toBe(true);
    expect(isRxValidOn(rx(), d("2026-11-16T18:30:00Z"))).toBe(false);
  });

  it("is valid at exactly rxDate (midnight IST) and invalid a ms before", () => {
    expect(isRxValidOn(rx(), d("2026-05-16T18:30:00Z"))).toBe(true);
    expect(isRxValidOn(rx(), d("2026-05-16T18:29:59.999Z"))).toBe(false);
  });

  it("honours an earlier pharmacist validUntil", () => {
    const r = rx({ validUntil: d("2026-08-16T18:30:00Z") });
    expect(isRxValidOn(r, d("2026-08-16T18:29:59.999Z"))).toBe(true);
    expect(isRxValidOn(r, d("2026-08-16T18:30:00Z"))).toBe(false);
  });

  it("caps a validUntil beyond 6 months", () => {
    const r = rx({ validUntil: d("2027-05-16T18:30:00Z") });
    expect(isRxValidOn(r, d("2026-11-16T18:30:00Z"))).toBe(false);
    expect(isRxValidOn(r, d("2026-11-16T18:29:59.999Z"))).toBe(true);
  });

  it("applies month-end clamping to the cap (31 Aug rx)", () => {
    const r = rx({ rxDate: d("2026-08-30T18:30:00Z") });
    expect(isRxValidOn(r, d("2027-02-27T18:29:59.999Z"))).toBe(true);
    expect(isRxValidOn(r, d("2027-02-27T18:30:00Z"))).toBe(false);
  });

  it("applies leap-year clamping to the cap", () => {
    const r = rx({ rxDate: d("2027-08-30T18:30:00Z") });
    expect(isRxValidOn(r, d("2028-02-28T18:29:59.999Z"))).toBe(true);
    expect(isRxValidOn(r, d("2028-02-28T18:30:00Z"))).toBe(false);
  });

  it("is false when rxDate is after the date judged", () => {
    expect(isRxValidOn(rx({ rxDate: d("2026-11-17T18:30:00Z") }), d("2026-11-16T06:00:00Z"))).toBe(
      false,
    );
  });

  it.each(["pending", "rejected"] as const)("is false when status is %s", (status) => {
    expect(isRxValidOn(rx({ status }), d("2026-06-01T00:00:00Z"))).toBe(false);
  });

  it("is false when rxDate is null", () => {
    expect(isRxValidOn(rx({ rxDate: null }), d("2026-06-01T00:00:00Z"))).toBe(false);
  });
});
