import { afterEach, describe, expect, it, vi } from "vitest";
import {
  MOTION_ALLOWED_QUERY,
  REDUCED_MOTION_QUERY,
  motionAllowed,
  prefersReducedMotion,
} from "./motion";

afterEach(() => vi.unstubAllGlobals());

function stubMedia(matching: string[]) {
  const asked: string[] = [];
  vi.stubGlobal("window", {
    matchMedia: (q: string) => {
      asked.push(q);
      return { matches: matching.includes(q) };
    },
  });
  return asked;
}

describe("motion", () => {
  it("names the two media queries the CSS uses", () => {
    expect(REDUCED_MOTION_QUERY).toBe("(prefers-reduced-motion: reduce)");
    expect(MOTION_ALLOWED_QUERY).toBe("(prefers-reduced-motion: no-preference)");
  });

  it("reads reduce for prefersReducedMotion and no-preference for motionAllowed", () => {
    const asked = stubMedia([REDUCED_MOTION_QUERY]);
    expect(prefersReducedMotion()).toBe(true);
    expect(motionAllowed()).toBe(false);
    expect(asked).toEqual([REDUCED_MOTION_QUERY, MOTION_ALLOWED_QUERY]);
  });

  it("is true for motionAllowed when no preference is set", () => {
    stubMedia([MOTION_ALLOWED_QUERY]);
    expect(motionAllowed()).toBe(true);
    expect(prefersReducedMotion()).toBe(false);
  });

  it("answers false for both where there is no window or no matchMedia", () => {
    vi.stubGlobal("window", undefined);
    expect([prefersReducedMotion(), motionAllowed()]).toEqual([false, false]);
    vi.stubGlobal("window", {});
    expect([prefersReducedMotion(), motionAllowed()]).toEqual([false, false]);
  });
});
