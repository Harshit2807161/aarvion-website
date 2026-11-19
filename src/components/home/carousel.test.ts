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

describe("carouselReducer hardening", () => {
  it("ignores a NaN or non-integer go index", () => {
    const s = running();
    expect(carouselReducer(s, { type: "go", index: NaN })).toBe(s);
    expect(carouselReducer(s, { type: "go", index: 1.5 })).toBe(s);
  });

  it("keeps the user's pause across a motion off then on", () => {
    let s = carouselReducer(running(), { type: "toggleStop" });
    s = carouselReducer(s, { type: "motion", on: false });
    s = carouselReducer(s, { type: "motion", on: true });
    expect(s).toMatchObject({ stopped: true, userPaused: true });
    expect(autoplaying(s)).toBe(false);
    s = carouselReducer(s, { type: "toggleStop" });
    expect(autoplaying(s)).toBe(true);
  });

  it("never resumes under a hold when motion comes back", () => {
    let s = carouselReducer(running(), { type: "hold", why: "hover", on: true });
    s = carouselReducer(s, { type: "motion", on: false });
    expect(s.holds).toEqual(["hover"]);
    s = carouselReducer(s, { type: "motion", on: true });
    expect(autoplaying(s)).toBe(false);
    expect(carouselReducer(s, { type: "tickEnd" }).current).toBe(0);
    s = carouselReducer(s, { type: "hold", why: "hover", on: false });
    expect(autoplaying(s)).toBe(true);
  });

  it("ready is idempotent and gates autoplay", () => {
    const s = initialCarousel(4, true);
    const r = carouselReducer(s, { type: "ready" });
    expect(r.ready).toBe(true);
    expect(autoplaying(r)).toBe(true);
    expect(carouselReducer(r, { type: "ready" })).toBe(r);
  });

  it("a hold that changes nothing returns the same state", () => {
    const s = running();
    expect(carouselReducer(s, { type: "hold", why: "hover", on: false })).toBe(s);
    const held = carouselReducer(s, { type: "hold", why: "hover", on: true });
    expect(carouselReducer(held, { type: "hold", why: "hover", on: true })).toBe(held);
  });
});

// The dot fill can end in the frame a hold or pause starts, before the paused play-state lands:
// that animationend arrives held, and the finished fill never runs again. The tick is kept.
describe("carouselReducer due tick", () => {
  it("keeps a tick that ends under a hold and advances once when the hold releases", () => {
    let s = carouselReducer(running(), { type: "hold", why: "hover", on: true });
    s = carouselReducer(s, { type: "tickEnd" });
    expect(s).toMatchObject({ current: 0, due: true });
    s = carouselReducer(s, { type: "hold", why: "hover", on: false });
    expect(s).toMatchObject({ current: 1, due: false });
  });

  it("waits for the last hold and the user's pause before applying it", () => {
    let s = carouselReducer(running(), { type: "toggleStop" });
    s = carouselReducer(s, { type: "hold", why: "focus", on: true });
    s = carouselReducer(s, { type: "tickEnd" });
    s = carouselReducer(s, { type: "toggleStop" });
    expect(s).toMatchObject({ current: 0, due: true });
    s = carouselReducer(s, { type: "hold", why: "focus", on: false });
    expect(s).toMatchObject({ current: 1, due: false });
  });

  it("drops a due tick on a manual move or when motion turns off, and never sets one before load", () => {
    const due = carouselReducer(carouselReducer(running(), { type: "hold", why: "touch", on: true }), { type: "tickEnd" });
    for (const e of [{ type: "next" }, { type: "prev" }, { type: "go", index: 2 }, { type: "motion", on: false }] as const) {
      expect(carouselReducer(due, e).due).toBe(false);
    }
    expect(carouselReducer(carouselReducer(due, { type: "next" }), { type: "hold", why: "touch", on: false }).current).toBe(1);
    expect(carouselReducer(initialCarousel(4, true), { type: "tickEnd" }).due).toBe(false);
  });
});
