import { describe, expect, it } from "vitest";
import {
  ACT_NUMBER,
  EASE,
  actProgress,
  deepLinkTarget,
  measureAct,
  parseRange,
  clamp01,
  type Range,
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
  it("is exact at both endpoints", () => {
    for (const f of Object.values(EASE)) {
      expect(f(0)).toBe(0);
      expect(f(1)).toBe(1);
    }
  });
});

describe("clamp01", () => {
  it("clamps and maps NaN to 0", () => {
    expect(clamp01(-1)).toBe(0);
    expect(clamp01(0.4)).toBe(0.4);
    expect(clamp01(2)).toBe(1);
    expect(clamp01(NaN)).toBe(0);
  });
});

describe("parseRange", () => {
  it("parses start, end and ease", () => {
    expect(parseRange(".34 .72 io")).toEqual([0.34, 0.72, EASE.io]);
  });
  it("defaults to linear", () => {
    expect(parseRange("0 .26")?.[2]).toBe(EASE.lin);
  });
  it("returns null for malformed numbers", () => {
    expect(parseRange("a b")).toBeNull();
    expect(parseRange(".3")).toBeNull();
    expect(parseRange("0 Infinity")).toBeNull();
  });
  it("ignores inherited keys as ease names", () => {
    expect(parseRange("0 1 constructor")?.[2]).toBe(EASE.lin);
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
  it("treats a zero-width range as a step", () => {
    const r: Range = [0.5, 0.5, EASE.lin];
    expect(rangeValue(r, 0.49)).toBe(0);
    expect(rangeValue(r, 0.5)).toBe(1);
    expect(rangeValue(r, 0.9)).toBe(1);
  });
  it("stays finite for NaN progress", () => {
    expect(rangeValue([0, 1, EASE.lin], NaN)).toBe(0);
    expect(rangeValue([NaN, NaN, EASE.lin], 0.5)).toBe(0);
  });
  it("rounds to 4 places", () => {
    expect(rangeValue([0, 3, EASE.lin], 1)).toBe(0.3333);
  });
});

describe("measureAct", () => {
  const base = {
    rectTop: 0,
    scrollY: 0,
    vh: 900,
    pinned: false,
    lead: false,
    offsetHeight: 0,
    stageHeight: 0,
    height: 0,
  };
  it("measures a pinned act", () => {
    const box = measureAct({
      ...base,
      pinned: true,
      offsetHeight: 2700,
      stageHeight: 900,
      height: 2700,
    });
    expect(box).toEqual({ top: 0, len: 1800 });
  });
  it("extends a lead pinned act back by one viewport", () => {
    const box = measureAct({
      ...base,
      rectTop: 6000,
      pinned: true,
      lead: true,
      offsetHeight: 1890,
      stageHeight: 900,
      height: 1890,
    });
    expect(box).toEqual({ top: 5100, len: 1890 });
  });
  it("measures a pass act", () => {
    const box = measureAct({ ...base, rectTop: 5000, scrollY: 1000, height: 800 });
    expect(box).toEqual({ top: 5100, len: 1700 });
  });
  it("never returns a zero length", () => {
    expect(measureAct({ ...base, pinned: true, offsetHeight: 900, stageHeight: 900 }).len).toBe(1);
  });
  it("falls back to finite values for NaN measurements", () => {
    const pinned = { ...base, pinned: true, offsetHeight: NaN, stageHeight: 900 };
    expect(measureAct(pinned)).toEqual({ top: 0, len: 1 });
    expect(measureAct({ ...base, height: NaN, rectTop: NaN })).toEqual({ top: 0, len: 1 });
    expect(measureAct({ ...pinned, lead: true })).toEqual({ top: -900, len: 901 });
  });
});

describe("actProgress", () => {
  it("is the unclamped fraction through the act", () => {
    expect(actProgress(900, { top: 0, len: 1800 })).toBe(0.5);
    expect(actProgress(-900, { top: 0, len: 1800 })).toBe(-0.5);
    expect(actProgress(3600, { top: 0, len: 1800 })).toBe(2);
  });
  it("stays finite for NaN input", () => {
    expect(actProgress(NaN, { top: 0, len: 1800 })).toBe(0);
    expect(actProgress(10, { top: 0, len: 0 })).toBe(0);
  });
});

describe("stepIndex", () => {
  it("splits at .34 and .67", () => {
    expect(stepIndex(0.33)).toBe(0);
    expect(stepIndex(0.34)).toBe(1);
    expect(stepIndex(0.67)).toBe(2);
    expect(stepIndex(0.66)).toBe(1);
    expect(stepIndex(0)).toBe(0);
    expect(stepIndex(-1)).toBe(0);
    expect(stepIndex(1)).toBe(2);
  });
});

describe("deepLinkTarget", () => {
  it("maps ?p=<act>:<progress> to a scroll position", () => {
    expect(ACT_NUMBER).toEqual({ how: 3, areas: 4, close: 5 });
    expect(deepLinkTarget("?p=3:0.5", [{ id: "how", top: 0, len: 1800 }])).toBe(900);
    expect(deepLinkTarget("?p=5:1.5", [{ id: "close", top: 5100, len: 1890 }])).toBe(6990);
  });
  it("finds the right act among several", () => {
    const acts = [
      { id: "how", top: 0, len: 1800 },
      { id: "areas", top: 2000, len: 1000 },
    ];
    expect(deepLinkTarget("?x=1&p=4:.25", acts)).toBe(2250);
  });
  it("returns null for malformed progress", () => {
    const acts = [{ id: "how", top: 0, len: 1800 }];
    expect(deepLinkTarget("?p=3:.", acts)).toBeNull();
    expect(deepLinkTarget("?p=3:1.2.3", acts)).toBeNull();
    expect(deepLinkTarget("?p=3:", acts)).toBeNull();
    expect(deepLinkTarget("?p=3:0.5", [{ id: "how", top: NaN, len: 1 }])).toBeNull();
  });
  it("returns null for unknown acts or no param", () => {
    expect(deepLinkTarget("?p=1:.5", [{ id: "how", top: 0, len: 1800 }])).toBeNull();
    expect(deepLinkTarget("", [{ id: "how", top: 0, len: 1800 }])).toBeNull();
  });
});
