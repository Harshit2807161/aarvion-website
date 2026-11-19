import { describe, expect, it } from "vitest";
import {
  DISMISS_FRACTION,
  DISMISS_MIN_PX,
  DISMISS_VELOCITY,
  dragOffset,
  shouldDismiss,
} from "./drag";

describe("thresholds", () => {
  it("match DESIGN.md: 28% of the height, 24px at 0.45px/ms", () => {
    expect([DISMISS_FRACTION, DISMISS_MIN_PX, DISMISS_VELOCITY]).toEqual([0.28, 24, 0.45]);
  });
});

describe("shouldDismiss(dy, height, ms)", () => {
  it("dismisses a slow drag past 28% of the height", () => {
    expect(shouldDismiss(200, 600, 500)).toBe(true);
  });

  it("keeps a slow drag short of 28%", () => {
    expect(shouldDismiss(160, 600, 1000)).toBe(false);
  });

  it("dismisses a short fast flick", () => {
    expect(shouldDismiss(30, 600, 50)).toBe(true);
  });

  it("keeps a short slow drag", () => {
    expect(shouldDismiss(30, 600, 100)).toBe(false);
  });

  it("ignores a flick under 24px however fast", () => {
    expect(shouldDismiss(24, 600, 10)).toBe(false);
  });

  it("never dismisses an upward drag", () => {
    expect(shouldDismiss(-300, 600, 10)).toBe(false);
  });

  it("treats a zero duration as 1ms", () => {
    expect(shouldDismiss(30, 600, 0)).toBe(true);
  });
});

describe("dragOffset(dy)", () => {
  it("follows the finger 1:1 downward", () => {
    expect(dragOffset(100)).toBe(100);
    expect(dragOffset(0)).toBe(0);
  });

  it("rubber-bands upward with a square-root falloff", () => {
    expect(dragOffset(-100)).toBe(-20);
    expect(dragOffset(-400)).toBe(-40);
  });
});
