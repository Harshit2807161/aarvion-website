import { describe, expect, it } from "vitest";
import {
  AUTOPLAY_MS,
  LEAVE_MS,
  PHONE_QUERY,
  TOUCH_RESUME_MS,
  autoplaying,
  carouselReducer,
  initialCarousel,
  liveMode,
  playLabel,
  type CarouselState,
} from "./carousel";

const running = (): CarouselState => ({ ...initialCarousel(4, true), ready: true });

describe("carousel constants", () => {
  it("match the design", () => {
    expect([AUTOPLAY_MS, TOUCH_RESUME_MS, LEAVE_MS, PHONE_QUERY]).toEqual([
      6000,
      4000,
      760,
      "(max-width: 719px)",
    ]);
  });
});

describe("carouselReducer navigation", () => {
  it("wraps next, prev and go", () => {
    expect(carouselReducer({ ...running(), current: 3 }, { type: "next" }).current).toBe(0);
    expect(carouselReducer(running(), { type: "prev" }).current).toBe(3);
    expect(carouselReducer(running(), { type: "go", index: 2 }).current).toBe(2);
    expect(carouselReducer(running(), { type: "go", index: 5 }).current).toBe(1);
    expect(carouselReducer(running(), { type: "go", index: -1 }).current).toBe(3);
  });
});

describe("carouselReducer autoplay", () => {
  it("starts stopped=false, not ready", () => {
    const s = initialCarousel(4, true);
    expect(s).toMatchObject({ current: 0, stopped: false, ready: false, holds: [] });
    expect(autoplaying(s)).toBe(false);
  });

  it("tickEnd advances only while autoplaying", () => {
    expect(carouselReducer(running(), { type: "tickEnd" }).current).toBe(1);
    expect(carouselReducer(initialCarousel(4, true), { type: "tickEnd" }).current).toBe(0);
    for (const why of ["hover", "focus", "touch", "hidden", "away"] as const) {
      const held = carouselReducer(running(), { type: "hold", why, on: true });
      expect(carouselReducer(held, { type: "tickEnd" }).current).toBe(0);
      const freed = carouselReducer(held, { type: "hold", why, on: false });
      expect(carouselReducer(freed, { type: "tickEnd" }).current).toBe(1);
    }
    const stopped = carouselReducer(running(), { type: "toggleStop" });
    expect(carouselReducer(stopped, { type: "tickEnd" }).current).toBe(0);
  });

  it("keeps independent holds until all release", () => {
    let s = carouselReducer(running(), { type: "hold", why: "hover", on: true });
    s = carouselReducer(s, { type: "hold", why: "focus", on: true });
    s = carouselReducer(s, { type: "hold", why: "hover", on: false });
    expect(autoplaying(s)).toBe(false);
    s = carouselReducer(s, { type: "hold", why: "focus", on: false });
    expect(autoplaying(s)).toBe(true);
  });

  it("is static without motion", () => {
    const s = { ...initialCarousel(4, false), ready: true };
    expect(s.stopped).toBe(true);
    expect(carouselReducer(s, { type: "tickEnd" })).toBe(s);
    expect(carouselReducer(s, { type: "toggleStop" })).toBe(s);
  });

  it("applies the motion preference once read", () => {
    const off = carouselReducer(running(), { type: "motion", on: false });
    expect(off).toMatchObject({ motion: false, stopped: true });
    expect(carouselReducer(off, { type: "motion", on: true })).toMatchObject({ motion: true, stopped: false });
  });
});

describe("labels", () => {
  it("liveMode is off only while autoplaying", () => {
    expect(liveMode(running())).toBe("off");
    expect(liveMode(initialCarousel(4, true))).toBe("polite");
    expect(liveMode(carouselReducer(running(), { type: "hold", why: "hover", on: true }))).toBe("polite");
    expect(liveMode(carouselReducer(running(), { type: "toggleStop" }))).toBe("polite");
  });

  it("playLabel strings are exact", () => {
    expect(playLabel(running())).toBe("Stop automatic slide show");
    expect(playLabel(carouselReducer(running(), { type: "toggleStop" }))).toBe("Start automatic slide show");
  });
});
