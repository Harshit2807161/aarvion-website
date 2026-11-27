/**
 * The home page's scroll film engine: native scroll, one passive listener and one
 * requestAnimationFrame tick. It writes `--ti` / `--to` on `[data-in]` / `[data-out]`
 * elements (CSS turns them into transform and opacity) and toggles `.is-active` on the
 * "How ordering works" steps. Ported from design/prototype/js/site.js (v2); the math is in
 * ./progress. It only ever touches elements inside `root` (never the store header).
 *
 * With `film: false` (reduced motion) the static composition needs no engine: nothing is
 * listened to or observed, and destroy() is a no-op.
 */
import {
  actProgress,
  clamp01,
  deepLinkTarget,
  measureAct,
  parseRange,
  rangeValue,
  stepIndex,
  type ActBox,
  type Range,
} from "./progress";

type Item = { el: HTMLElement; i: Range | null; o: Range | null; vi: number; vo: number };
type Act = {
  id: string;
  el: HTMLElement;
  stage: HTMLElement | null;
  pinned: boolean;
  lead: boolean;
  on: boolean;
  p: number;
  box: ActBox;
  items: Item[];
};

const DEBOUNCE_MS = 120;

export function createFilm(root: HTMLElement, o: { film: boolean }): { destroy(): void } {
  if (!o.film) return { destroy() {} };

  const acts: Act[] = [...root.querySelectorAll<HTMLElement>("[data-act]")].map((el) => ({
    id: el.id,
    el,
    stage: el.querySelector<HTMLElement>(".stage"),
    pinned: el.dataset.act === "pin",
    lead: el.hasAttribute("data-lead"),
    on: false,
    p: -1,
    box: { top: 0, len: 1 },
    items: [el, ...el.querySelectorAll<HTMLElement>("[data-in],[data-out]")]
      .filter((a) => a.dataset.in || a.dataset.out)
      .map((a) => ({
        el: a,
        i: parseRange(a.dataset.in),
        o: parseRange(a.dataset.out),
        vi: -1,
        vo: -1,
      })),
  }));
  const steps = [...root.querySelectorAll<HTMLElement>(".step")];
  const byEl = new Map(acts.map((a) => [a.el, a]));

  let queued = false;
  let raf = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let step = -1;
  let dead = false;
  const decoded = new WeakSet<HTMLImageElement>();

  const hooks: Record<string, (p: number) => void> = {
    how(p) {
      const i = stepIndex(p);
      if (i === step) return;
      step = i;
      steps.forEach((s, k) => s.classList.toggle("is-active", k === i));
    },
  };

  function tick() {
    queued = false;
    const y = window.scrollY;
    for (const a of acts) {
      if (!a.on) continue;
      const p = clamp01(actProgress(y, a.box));
      if (p === a.p) continue;
      a.p = p;
      for (const x of a.items) {
        if (x.i) {
          const v = rangeValue(x.i, p);
          if (v !== x.vi) {
            x.vi = v;
            x.el.style.setProperty("--ti", String(v));
          }
        }
        if (x.o) {
          const v = rangeValue(x.o, p);
          if (v !== x.vo) {
            x.vo = v;
            x.el.style.setProperty("--to", String(v));
          }
        }
      }
      hooks[a.id]?.(p);
    }
  }

  function dirty() {
    if (queued || dead) return;
    queued = true;
    raf = requestAnimationFrame(tick);
  }

  function measure() {
    const vh = window.innerHeight;
    const y = window.scrollY;
    root.classList.add("measuring");
    for (const a of acts) {
      const r = a.el.getBoundingClientRect();
      a.box = measureAct({
        rectTop: r.top,
        scrollY: y,
        vh,
        pinned: a.pinned,
        lead: a.lead,
        offsetHeight: a.el.offsetHeight,
        stageHeight: a.stage?.offsetHeight ?? 0,
        height: r.height,
      });
      a.p = -1;
    }
    root.classList.remove("measuring");
    tick();
  }

  const remeasure = () => {
    clearTimeout(timer);
    timer = setTimeout(measure, DEBOUNCE_MS);
  };

  measure();

  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        const a = byEl.get(e.target as HTMLElement);
        if (!a) continue;
        a.on = e.isIntersecting;
        a.p = -1;
        a.el.classList.toggle("live", a.on);
        if (a.on) {
          for (const img of a.el.querySelectorAll("img")) {
            img.loading = "eager";
            if (decoded.has(img)) continue;
            decoded.add(img);
            img.decode?.().catch(() => {});
          }
        }
      }
      dirty();
    },
    { rootMargin: "100% 0px" },
  );
  acts.forEach((a) => io.observe(a.el));

  window.addEventListener("scroll", dirty, { passive: true });
  window.addEventListener("resize", remeasure, { passive: true });
  // A ResizeObserver reports once on observe; measure() already ran, so that report is skipped.
  let firstResize = true;
  const ro = new ResizeObserver(() => {
    if (firstResize) firstResize = false;
    else remeasure();
  });
  ro.observe(document.body);

  // Like the prototype, the ?p= jump waits for load: images and fonts settle the layout first.
  const start = () => {
    if (dead) return;
    measure();
    const y = deepLinkTarget(
      location.search,
      acts.map((a) => ({ id: a.id, ...a.box })),
    );
    if (y !== null) window.scrollTo(0, y);
  };
  if (document.readyState === "complete") start();
  else window.addEventListener("load", start, { once: true });

  return {
    destroy() {
      dead = true;
      window.removeEventListener("scroll", dirty);
      window.removeEventListener("resize", remeasure);
      window.removeEventListener("load", start);
      io.disconnect();
      ro.disconnect();
      clearTimeout(timer);
      cancelAnimationFrame(raf);
    },
  };
}
