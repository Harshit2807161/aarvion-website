import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { addCalendarMonthsIst, isRxValidOn, type RxSnapshot } from "./validity";

const d = (s: string) => new Date(s);
const rx = (over: Partial<RxSnapshot> = {}): RxSnapshot => ({
  status: "approved",
  rxDate: d("2026-05-16T18:30:00Z"),
  validUntil: null,
  ...over,
});

describe("addCalendarMonthsIst named month-end cases", () => {
  it("31 Mar + 6 months -> 30 Sep (IST)", () => {
    // 31 Mar 2026 00:00 IST = 2026-03-30T18:30Z; 30 Sep 2026 00:00 IST = 2026-09-29T18:30Z
    expect(addCalendarMonthsIst(d("2026-03-30T18:30:00Z"), 6).toISOString()).toBe(
      "2026-09-29T18:30:00.000Z",
    );
  });

  it("29 Feb (leap) + 6 months -> 29 Aug (IST)", () => {
    // 29 Feb 2028 00:00 IST = 2028-02-28T18:30Z; 29 Aug 2028 00:00 IST = 2028-08-28T18:30Z
    expect(addCalendarMonthsIst(d("2028-02-28T18:30:00Z"), 6).toISOString()).toBe(
      "2028-08-28T18:30:00.000Z",
    );
  });
});

describe("isRxValidOn valid-until versus the cap", () => {
  const cap = d("2026-11-16T18:30:00Z");
  it("validUntil equal to the cap behaves like the cap", () => {
    const r = rx({ validUntil: cap });
    expect(isRxValidOn(r, d("2026-11-16T18:29:59.999Z"))).toBe(true);
    expect(isRxValidOn(r, cap)).toBe(false);
  });
  it("validUntil one ms under the cap ends one ms earlier", () => {
    const r = rx({ validUntil: d("2026-11-16T18:29:59.999Z") });
    expect(isRxValidOn(r, d("2026-11-16T18:29:59.998Z"))).toBe(true);
    expect(isRxValidOn(r, d("2026-11-16T18:29:59.999Z"))).toBe(false);
  });
  it("validUntil before rxDate is never valid", () => {
    const r = rx({ validUntil: d("2026-05-01T00:00:00Z") });
    expect(isRxValidOn(r, d("2026-05-16T18:30:00Z"))).toBe(false);
  });
});

describe("invalid dates", () => {
  it("addCalendarMonthsIst of an invalid Date stays invalid", () => {
    expect(Number.isNaN(addCalendarMonthsIst(new Date(NaN), 6).getTime())).toBe(true);
  });
  it("isRxValidOn is false for an invalid `on`", () => {
    expect(isRxValidOn(rx(), new Date(NaN))).toBe(false);
  });
  it("isRxValidOn is false for an invalid rxDate or validUntil", () => {
    expect(isRxValidOn(rx({ rxDate: new Date(NaN) }), d("2026-06-01T00:00:00Z"))).toBe(false);
    expect(isRxValidOn(rx({ validUntil: new Date(NaN) }), d("2026-06-01T00:00:00Z"))).toBe(false);
  });
});

describe("server time zone independence", () => {
  const modulePath = fileURLToPath(new URL("./validity.ts", import.meta.url));
  const script = `
    const m = await import(${JSON.stringify("file://" + modulePath)});
    const out = {
      clamp: m.addCalendarMonthsIst(new Date("2026-08-30T18:30:00Z"), 6).toISOString(),
      leap: m.addCalendarMonthsIst(new Date("2027-08-30T18:30:00Z"), 6).toISOString(),
      before: m.isRxValidOn({ status: "approved", rxDate: new Date("2026-05-16T18:30:00Z"), validUntil: null }, new Date("2026-11-16T18:29:59.999Z")),
      at: m.isRxValidOn({ status: "approved", rxDate: new Date("2026-05-16T18:30:00Z"), validUntil: null }, new Date("2026-11-16T18:30:00Z")),
      midnight: m.istMidnight("2026-11-12").toISOString(),
      dayBefore: m.istDay(new Date("2026-11-11T18:29:59.999Z")),
      dayAfter: m.istDay(new Date("2026-11-11T18:30:00.000Z")),
      end: m.rxEnd({ rxDate: new Date("2026-05-16T18:30:00Z"), validUntil: null }).toISOString(),
      impossible: (() => { try { m.istMidnight("2027-02-30"); return "no throw"; } catch (e) { return e instanceof RangeError ? "RangeError" : "other"; } })(),
    };
    console.log(JSON.stringify(out));
  `;
  it.each(["UTC", "America/Los_Angeles", "Pacific/Auckland", "Asia/Kolkata"])(
    "gives identical results under TZ=%s",
    (tz) => {
      const stdout = execFileSync(
        process.execPath,
        ["--experimental-strip-types", "--no-warnings", "--input-type=module", "-e", script],
        { env: { ...process.env, TZ: tz }, encoding: "utf8" },
      );
      expect(JSON.parse(stdout)).toEqual({
        clamp: "2027-02-27T18:30:00.000Z",
        leap: "2028-02-28T18:30:00.000Z",
        before: true,
        at: false,
        midnight: "2026-11-11T18:30:00.000Z",
        dayBefore: "2026-11-11",
        dayAfter: "2026-11-12",
        end: "2026-11-16T18:30:00.000Z",
        impossible: "RangeError",
      });
    },
  );
});
