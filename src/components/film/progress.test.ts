import { describe, expect, it } from "vitest";
import {
  ACT_NUMBER,
  EASE,
  actProgress,
  deepLinkTarget,
  measureAct,
  parseRange,
  rangeValue,
  stepIndex,
} from "./progress";

describe("EASE", () => {
  it("matches the prototype curves", () => {
    expect(EASE.out(0.5)).toBe(0.875);
    expect(EASE.in(0.5)).toBe(0.125);
    expect(EASE.io(0.25)).toBe(0.0625);
    expect(EASE.io(0.75)).toBe(0.9375);
    expect(EASE.lin(0.3)).toBe(0.3);
  });
});

describe("parseRange", () => {
  it("parses start, end and ease", () => {
    expect(parseRange(".34 .72 io")).toEqual([0.34, 0.72, EASE.io]);
  });
  it("defaults to linear", () => {
    expect(parseRange("0 .26")?.[2]).toBe(EASE.lin);
  });
  it("returns null for empty input", () => {
    expect(parseRange("")).toBeNull();
    expect(parseRange(undefined)).toBeNull();
  });
});

describe("rangeValue", () => {
  it("eases and clamps", () => {
    const r = [0, 0.26, EASE.io] as const;
    expect(rangeValue([...r], 0.13)).toBe(0.5);
    expect(rangeValue([...r], -1)).toBe(0);
    expect(rangeValue([...r], 2)).toBe(1);
  });
  it("rounds to 4 places", () => {
    expect(rangeValue([0, 3, EASE.lin], 1)).toBe(0.3333);
  });
});

describe("measureAct", () => {
  const base = { rectTop: 0, scrollY: 0, vh: 900, pinned: false, lead: false, offsetHeight: 0, stageHeight: 0, height: 0 };
  it("measures a pinned act", () => {
    expect(measureAct({ ...base, pinned: true, offsetHeight: 2700, stageHeight: 900, height: 2700 })).toEqual({ top: 0, len: 1800 });
  });
  it("extends a lead pinned act back by one viewport", () => {
    expect(
      measureAct({ ...base, rectTop: 6000, pinned: true, lead: true, offsetHeight: 1890, stageHeight: 900, height: 1890 }),
    ).toEqual({ top: 5100, len: 1890 });
  });
  it("measures a pass act", () => {
    expect(measureAct({ ...base, rectTop: 5000, scrollY: 1000, height: 800 })).toEqual({ top: 5100, len: 1700 });
  });
  it("never returns a zero length", () => {
    expect(measureAct({ ...base, pinned: true, offsetHeight: 900, stageHeight: 900 }).len).toBe(1);
  });
});

describe("actProgress", () => {
  it("is the unclamped fraction through the act", () => {
    expect(actProgress(900, { top: 0, len: 1800 })).toBe(0.5);
  });
});

describe("stepIndex", () => {
  it("splits at .34 and .67", () => {
    expect(stepIndex(0.33)).toBe(0);
    expect(stepIndex(0.34)).toBe(1);
    expect(stepIndex(0.67)).toBe(2);
  });
});

describe("deepLinkTarget", () => {
  it("maps ?p=<act>:<progress> to a scroll position", () => {
    expect(ACT_NUMBER).toEqual({ how: 3, areas: 4, close: 5 });
    expect(deepLinkTarget("?p=3:0.5", [{ id: "how", top: 0, len: 1800 }])).toBe(900);
    expect(deepLinkTarget("?p=5:1.5", [{ id: "close", top: 5100, len: 1890 }])).toBe(6990);
  });
  it("returns null for unknown acts or no param", () => {
    expect(deepLinkTarget("?p=1:.5", [{ id: "how", top: 0, len: 1800 }])).toBeNull();
    expect(deepLinkTarget("", [{ id: "how", top: 0, len: 1800 }])).toBeNull();
  });
});
