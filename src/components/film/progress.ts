/**
 * Pure progress and easing math for the home page's scroll film (the "How
 * ordering works" steps, the category tiles rising, the logo pan-in close).
 * Ported from design/prototype/js/site.js (v2). No DOM access here: callers
 * pass measurements in, so everything is unit-testable.
 */

export type Ease = (t: number) => number;
export type EaseName = "lin" | "out" | "in" | "io";

export const EASE: Record<EaseName, Ease> = {
  lin: (t) => t,
  out: (t) => 1 - (1 - t) ** 3,
  in: (t) => t * t * t,
  io: (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2),
};

/** [start, end, ease] in act progress (0..1). */
export type Range = [start: number, end: number, ease: Ease];

/** Clamps to 0..1; NaN maps to 0 so callers never see a non-finite value. */
export const clamp01 = (v: number): number => (v > 0 ? (v < 1 ? v : 1) : 0);

/** Parses "start end [ease]" (as in data-in / data-out); linear by default. */
export function parseRange(spec: string | undefined | null): Range | null {
  if (!spec) return null;
  const [s, e, name] = spec.split(" ");
  const start = Number(s);
  const end = Number(e);
  if (!s || !e || !Number.isFinite(start) || !Number.isFinite(end)) return null;
  const ease = name && Object.hasOwn(EASE, name) ? EASE[name as EaseName] : EASE.lin;
  return [start, end, ease];
}

/** Eased value of a range at act progress p, clamped and rounded to 4 places. */
export function rangeValue(r: Range, p: number): number {
  const span = r[1] - r[0];
  // A zero-width (or non-finite) range is a step: 0 before the point, 1 at or after it.
  if (!(span > 0) || !Number.isFinite(span)) return p >= r[0] ? 1 : 0;
  return +r[2](clamp01((p - r[0]) / span)).toFixed(4);
}

/** Scroll box of an act: it starts at `top` and runs for `len` pixels. */
export type ActBox = { top: number; len: number };

export type MeasureInput = {
  rectTop: number;
  scrollY: number;
  vh: number;
  pinned: boolean;
  lead: boolean;
  offsetHeight: number;
  stageHeight: number;
  height: number;
};

export function measureAct(m: MeasureInput): ActBox {
  const t = m.rectTop + m.scrollY - (m.pinned ? 0 : m.vh);
  let top = Number.isFinite(t) ? t : 0;
  const raw = m.pinned ? m.offsetHeight - m.stageHeight : m.height + m.vh;
  let len = Number.isFinite(raw) ? Math.max(1, raw) : 1;
  if (m.lead) {
    top -= m.vh;
    len += m.vh;
  }
  return { top, len };
}

/** Unclamped progress through an act; clamp via rangeValue. */
export function actProgress(scrollY: number, a: ActBox): number {
  const p = (scrollY - a.top) / a.len;
  return Number.isFinite(p) ? p : 0;
}

/** Which of the three "How ordering works" steps is active. */
export function stepIndex(p: number): 0 | 1 | 2 {
  return p < 0.34 ? 0 : p < 0.67 ? 1 : 2;
}

/** `?p=<act>:<progress>` capture numbers. */
export const ACT_NUMBER = { how: 3, areas: 4, close: 5 } as const;

/** Scroll target for a `?p=<act>:<progress>` deep link, or null. */
export function deepLinkTarget(search: string, acts: (ActBox & { id: string })[]): number | null {
  const m = /[?&]p=(\d):(\d*\.?\d+)(?![\d.])/.exec(search);
  if (!m) return null;
  const n = Number(m[1]);
  const act = acts.find((a) => ACT_NUMBER[a.id as keyof typeof ACT_NUMBER] === n);
  if (!act) return null;
  const target = Math.round(act.top + clamp01(Number(m[2])) * act.len);
  return Number.isFinite(target) ? target : null;
}
