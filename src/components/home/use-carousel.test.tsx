import { act, render } from "@testing-library/react";
import { useEffect, useRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { liveMode } from "./carousel";
import { useCarousel } from "./use-carousel";

type Api = ReturnType<typeof useCarousel>;
const holder: { current: Api | null } = { current: null };
/** Latest hook value, captured in an effect so render stays pure. */
const live = {
  get state() { return holder.current!.state; },
  go: (i: number) => holder.current!.go(i),
  toggleStop: () => holder.current!.toggleStop(),
};

function Fixture() {
  const rootRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const value = useCarousel({ count: 4, rootRef, trackRef });
  useEffect(() => { holder.current = value; });
  return (
    <div ref={rootRef} data-testid="root">
      <div ref={trackRef} className="hero-track" data-testid="track">
        {[0, 1, 2, 3].map((i) => (
          <section key={i} className="slide" data-testid={`slide-${i}`}>
            {i === 0 ? (
              // eslint-disable-next-line @next/next/no-img-element -- a plain fixture
              <img alt="" src="/s0.webp" loading="eager" />
            ) : (
              <picture>
                <source data-srcset={`/s${i}-m.webp 840w`} />
                <img alt="" data-src={`/s${i}.webp`} data-srcset={`/s${i}.webp 1792w`} loading="lazy" />
              </picture>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}

const REDUCED = "(prefers-reduced-motion: reduce)";
const PHONE = "(max-width: 719px)";
type Mql = { matches: boolean; media: string; fns: Set<() => void> };
/** One list per query, so a test can flip it and fire its `change` listeners. */
const mqls = new Map<string, Mql>();

function mockMedia({ reduced, phone }: { reduced: boolean; phone: boolean }) {
  mqls.clear();
  vi.stubGlobal("matchMedia", (query: string) => {
    if (!mqls.has(query)) {
      const matches = query === REDUCED ? reduced : query === PHONE ? phone : false;
      mqls.set(query, { matches, media: query, fns: new Set() });
    }
    const m = mqls.get(query)!;
    return Object.assign(m, {
      addEventListener: (_: string, fn: () => void) => m.fns.add(fn),
      removeEventListener: (_: string, fn: () => void) => m.fns.delete(fn),
    });
  });
}

function flipMedia(query: string, matches: boolean) {
  const m = mqls.get(query)!;
  m.matches = matches;
  act(() => m.fns.forEach((fn) => fn()));
}

/** A stand-in IntersectionObserver whose callback the test drives. */
const io = { cb: null as ((entries: { isIntersecting: boolean }[]) => void) | null, disconnect: vi.fn() };
function mockIntersection() {
  io.cb = null;
  io.disconnect.mockClear();
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      constructor(cb: (entries: { isIntersecting: boolean }[]) => void) {
        io.cb = cb;
      }
      observe() {}
      disconnect() {
        io.disconnect();
      }
    },
  );
}

function fire(el: Element | Window | Document, type: string, props: Record<string, unknown> = {}) {
  const ev = new Event(type, { bubbles: true });
  Object.assign(ev, props);
  act(() => void el.dispatchEvent(ev));
}

const runEnd = (root: Element) => fire(root, "animationend", { animationName: "dot-run" });
const mouse = { pointerType: "mouse" };
const touch = { pointerType: "touch" };

const hide = (value: boolean) => {
  Object.defineProperty(document, "hidden", { configurable: true, value });
  fire(document, "visibilitychange");
};

function mount(opts: { reduced: boolean; phone: boolean }) {
  mockMedia(opts);
  const view = render(<Fixture />);
  fire(window, "load");
  return {
    unmount: view.unmount,
    root: view.getByTestId("root"),
    track: view.getByTestId("track"),
    slide: (i: number) => view.getByTestId(`slide-${i}`),
    img: (i: number) => view.getByTestId(`slide-${i}`).querySelector("img")!,
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  Object.defineProperty(document, "hidden", { configurable: true, value: false });
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("useCarousel under reduced motion", () => {
  it("never autoplays and ignores toggleStop", () => {
    const m = mount({ reduced: true, phone: false });
    runEnd(m.root);
    expect(live.state.current).toBe(0);
    expect(live.state.stopped).toBe(true);
    act(() => live.toggleStop());
    expect(live.state.stopped).toBe(true);
    expect(liveMode(live.state)).toBe("polite");
  });
});

describe("useCarousel with motion", () => {
  it("advances on the dot-run animationend, ignoring other animations", () => {
    const m = mount({ reduced: false, phone: false });
    expect(liveMode(live.state)).toBe("off");
    fire(m.root, "animationend", { animationName: "other" });
    expect(live.state.current).toBe(0);
    runEnd(m.root);
    expect(live.state.current).toBe(1);
  });

  it("holds on mouse hover and resumes on leave", () => {
    const m = mount({ reduced: false, phone: false });
    fire(m.root, "pointerenter", mouse);
    expect(liveMode(live.state)).toBe("polite");
    runEnd(m.root);
    expect(live.state.current).toBe(0);
    fire(m.root, "pointerleave", mouse);
    expect(liveMode(live.state)).toBe("off");
    expect(live.state.current).toBe(1);
    runEnd(m.root);
    expect(live.state.current).toBe(2);
  });

  it("holds while focus is inside and releases when it leaves the root", () => {
    const m = mount({ reduced: false, phone: false });
    fire(m.root, "focusin");
    expect(liveMode(live.state)).toBe("polite");
    fire(m.root, "focusout", { relatedTarget: m.track });
    expect(liveMode(live.state)).toBe("polite");
    fire(m.root, "focusout", { relatedTarget: null });
    expect(liveMode(live.state)).toBe("off");
  });

  it("releases a touch hold only 4000 ms after pointerup", () => {
    const m = mount({ reduced: false, phone: false });
    fire(m.track, "pointerdown", touch);
    expect(liveMode(live.state)).toBe("polite");
    fire(m.track, "pointerup", touch);
    act(() => void vi.advanceTimersByTime(3999));
    expect(liveMode(live.state)).toBe("polite");
    act(() => void vi.advanceTimersByTime(1));
    expect(liveMode(live.state)).toBe("off");
  });

  it("holds while the tab is hidden", () => {
    mount({ reduced: false, phone: false });
    hide(true);
    expect(liveMode(live.state)).toBe("polite");
    hide(false);
    expect(liveMode(live.state)).toBe("off");
  });

  it("starts held when the tab is already hidden at mount", () => {
    Object.defineProperty(document, "hidden", { configurable: true, value: true });
    const m = mount({ reduced: false, phone: false });
    expect(liveMode(live.state)).toBe("polite");
    runEnd(m.root);
    expect(live.state.current).toBe(0);
    hide(false);
    expect(liveMode(live.state)).toBe("off");
  });

  it("releases a touch hold 4000 ms after pointercancel too", () => {
    const m = mount({ reduced: false, phone: false });
    fire(m.track, "pointerdown", touch);
    fire(m.track, "pointercancel", touch);
    act(() => void vi.advanceTimersByTime(3999));
    expect(liveMode(live.state)).toBe("polite");
    act(() => void vi.advanceTimersByTime(1));
    expect(liveMode(live.state)).toBe("off");
  });

  it("holds while the banner is off screen (away)", () => {
    mockIntersection();
    mount({ reduced: false, phone: false });
    act(() => io.cb!([{ isIntersecting: false }]));
    expect(live.state.holds).toEqual(["away"]);
    act(() => io.cb!([{ isIntersecting: true }]));
    expect(liveMode(live.state)).toBe("off");
  });

  it("toggleStop stops and restarts autoplay, applying a fill that ended as it stopped", () => {
    const m = mount({ reduced: false, phone: false });
    act(() => live.toggleStop());
    runEnd(m.root);
    expect(live.state.current).toBe(0);
    act(() => live.toggleStop());
    expect(live.state.current).toBe(1);
    runEnd(m.root);
    expect(live.state.current).toBe(2);
  });
});

describe("useCarousel DOM", () => {
  it("desktop: only the current slide is interactive; the outgoing one is is-leaving for 760 ms", () => {
    const m = mount({ reduced: false, phone: false });
    expect(m.slide(0)).not.toHaveAttribute("inert");
    for (const i of [1, 2, 3]) expect(m.slide(i)).toHaveAttribute("inert");
    act(() => live.go(1));
    expect(live.state.current).toBe(1);
    expect(m.slide(0)).toHaveClass("is-leaving");
    expect(m.slide(1)).toHaveClass("is-current");
    expect(m.slide(1)).not.toHaveAttribute("inert");
    expect(m.slide(0)).toHaveAttribute("inert");
    act(() => void vi.advanceTimersByTime(759));
    expect(m.slide(0)).toHaveClass("is-leaving");
    act(() => void vi.advanceTimersByTime(1));
    expect(m.slide(0)).not.toHaveClass("is-leaving");
  });

  it("phone: no slide is inert, and go scrolls the track", () => {
    const m = mount({ reduced: false, phone: true });
    for (const i of [0, 1, 2, 3]) expect(m.slide(i)).not.toHaveAttribute("inert");
    const scrollTo = vi.fn();
    m.track.scrollTo = scrollTo as unknown as typeof m.track.scrollTo;
    act(() => live.go(2));
    expect(scrollTo).toHaveBeenCalledWith(expect.objectContaining({ behavior: "smooth" }));
  });

  it("phone: go ignores a non-integer index, like the reducer, and does not scroll", () => {
    const m = mount({ reduced: false, phone: true });
    const scrollTo = vi.fn();
    m.track.scrollTo = scrollTo as unknown as typeof m.track.scrollTo;
    act(() => live.go(Number.NaN));
    act(() => live.go(1.5));
    expect(scrollTo).not.toHaveBeenCalled();
    expect(live.state.current).toBe(0);
  });

  it("phone: a settled scroll sets current to the nearest slide, the last at the end", () => {
    const m = mount({ reduced: false, phone: true });
    [0, 1, 2, 3].forEach((i) => Object.defineProperty(m.slide(i), "offsetLeft", { configurable: true, value: i * 300 }));
    Object.defineProperty(m.track, "clientWidth", { configurable: true, value: 400 });
    Object.defineProperty(m.track, "scrollWidth", { configurable: true, value: 1200 });
    m.track.scrollLeft = 330;
    fire(m.track, "scroll");
    act(() => void vi.advanceTimersByTime(89));
    expect(live.state.current).toBe(0);
    act(() => void vi.advanceTimersByTime(1));
    expect(live.state.current).toBe(1);
    m.track.scrollLeft = 800;
    fire(m.track, "scroll");
    act(() => void vi.advanceTimersByTime(90));
    expect(live.state.current).toBe(3);
  });

  it("makes the remaining slides' images eager on window load", () => {
    const m = mount({ reduced: false, phone: false });
    for (const i of [1, 2, 3]) expect(m.img(i)).toHaveAttribute("loading", "eager");
  });

  it("gives the later slides' pictures their real sources on window load, and not before", () => {
    const m = mount({ reduced: false, phone: false });
    for (const i of [1, 2, 3]) {
      expect(m.img(i)).toHaveAttribute("src", `/s${i}.webp`);
      expect(m.img(i)).toHaveAttribute("srcset", `/s${i}.webp 1792w`);
      expect(m.img(i)).not.toHaveAttribute("data-src");
      const source = m.img(i).previousElementSibling!;
      expect(source).toHaveAttribute("srcset", `/s${i}-m.webp 840w`);
      expect(source).not.toHaveAttribute("data-srcset");
    }
    expect(m.img(0)).not.toHaveAttribute("srcset");
  });
});

describe("useCarousel media changes", () => {
  it("follows a live reduced-motion flip, and the user's pause survives it", () => {
    const m = mount({ reduced: false, phone: false });
    flipMedia(REDUCED, true);
    expect(live.state).toMatchObject({ motion: false, stopped: true });
    runEnd(m.root);
    expect(live.state.current).toBe(0);
    flipMedia(REDUCED, false);
    runEnd(m.root);
    expect(live.state.current).toBe(1);

    act(() => live.toggleStop());
    flipMedia(REDUCED, true);
    flipMedia(REDUCED, false);
    expect(live.state).toMatchObject({ motion: true, stopped: true, userPaused: true });
  });

  it("re-marks the slides when the phone query flips", () => {
    const m = mount({ reduced: false, phone: false });
    [0, 1, 2, 3].forEach((i) => Object.defineProperty(m.slide(i), "offsetLeft", { configurable: true, value: i * 300 }));
    act(() => live.go(2));
    flipMedia(PHONE, true);
    for (const i of [0, 1, 2, 3]) expect(m.slide(i)).not.toHaveAttribute("inert");
    expect(m.slide(0)).not.toHaveClass("is-leaving");
    expect(m.track.scrollLeft).toBe(600);
    flipMedia(PHONE, false);
    for (const i of [0, 1, 3]) expect(m.slide(i)).toHaveAttribute("inert");
    expect(m.slide(2)).not.toHaveAttribute("inert");
  });
});

describe("useCarousel unmount", () => {
  it("removes every listener, observer and timer", () => {
    mockIntersection();
    const added = vi.spyOn(document, "addEventListener");
    const removed = vi.spyOn(document, "removeEventListener");
    const m = mount({ reduced: false, phone: false });
    fire(m.track, "pointerdown", touch);
    fire(m.track, "pointerup", touch);
    act(() => live.go(1));
    expect(vi.getTimerCount()).toBeGreaterThan(0);
    m.unmount();
    expect(vi.getTimerCount()).toBe(0);
    expect(io.disconnect).toHaveBeenCalledTimes(1);
    for (const mq of mqls.values()) expect(mq.fns.size).toBe(0);
    const visibility = (spy: typeof added) => spy.mock.calls.filter(([type]) => type === "visibilitychange");
    expect(visibility(removed)).toHaveLength(visibility(added).length);
    added.mockRestore();
    removed.mockRestore();
  });
});
