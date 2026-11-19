/** Banner carousel state machine (pure). The DOM side lives in `use-carousel.ts`. */

export const AUTOPLAY_MS = 6000;
export const TOUCH_RESUME_MS = 4000;
export const LEAVE_MS = 760;
export const PHONE_QUERY = "(max-width: 719px)";

export type Hold = "hover" | "focus" | "touch" | "hidden" | "away";

export type CarouselState = {
  count: number;
  current: number;
  /** True when autoplay is off: the user paused it, or motion is reduced. */
  stopped: boolean;
  /** The user's own pause, kept apart so a motion flip never clears it. */
  userPaused: boolean;
  holds: readonly Hold[];
  ready: boolean;
  motion: boolean;
  /**
   * A tick that ended while held or paused. The fill can end in the very frame a hold starts,
   * before its paused play-state applies, and a finished fill never ends again; so the tick is
   * kept and lands as soon as autoplay can run. A manual move or motion turning off drops it.
   */
  due: boolean;
};

export type CarouselEvent =
  | { type: "go"; index: number }
  | { type: "next" }
  | { type: "prev" }
  | { type: "toggleStop" }
  | { type: "hold"; why: Hold; on: boolean }
  | { type: "ready" }
  | { type: "tickEnd" }
  /** The reduced-motion preference is only readable in an effect, so it arrives as an event. */
  | { type: "motion"; on: boolean };

export function initialCarousel(count: number, motion: boolean): CarouselState {
  return { count, current: 0, stopped: !motion, userPaused: false, holds: [], ready: false, motion, due: false };
}

const wrap = (i: number, count: number) => (count > 0 ? ((i % count) + count) % count : 0);

export function autoplaying(s: CarouselState): boolean {
  return s.ready && s.motion && !s.stopped && s.holds.length === 0;
}

export function liveMode(s: CarouselState): "off" | "polite" {
  return autoplaying(s) ? "off" : "polite";
}

export function playLabel(s: CarouselState): string {
  return s.stopped ? "Start automatic slide show" : "Stop automatic slide show";
}

export function carouselReducer(s: CarouselState, e: CarouselEvent): CarouselState {
  const n = step(s, e);
  return n.due && autoplaying(n) ? { ...n, current: wrap(n.current + 1, n.count), due: false } : n;
}

function step(s: CarouselState, e: CarouselEvent): CarouselState {
  switch (e.type) {
    case "go":
      if (!Number.isInteger(e.index)) return s;
      return { ...s, current: wrap(e.index, s.count), due: false };
    case "next":
      return { ...s, current: wrap(s.current + 1, s.count), due: false };
    case "prev":
      return { ...s, current: wrap(s.current - 1, s.count), due: false };
    case "toggleStop":
      return s.motion ? { ...s, userPaused: !s.userPaused, stopped: !s.userPaused } : s;
    case "hold": {
      const has = s.holds.includes(e.why);
      if (e.on === has) return s;
      return { ...s, holds: e.on ? [...s.holds, e.why] : s.holds.filter((h) => h !== e.why) };
    }
    case "ready":
      return s.ready ? s : { ...s, ready: true };
    case "tickEnd":
      if (autoplaying(s)) return { ...s, current: wrap(s.current + 1, s.count) };
      return s.ready && s.motion && !s.due ? { ...s, due: true } : s;
    case "motion":
      return e.on === s.motion ? s : { ...s, motion: e.on, stopped: !e.on || s.userPaused, due: e.on && s.due };
  }
}
