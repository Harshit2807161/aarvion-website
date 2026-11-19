import { act, render } from "@testing-library/react";
import { useEffect, useRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { liveMode } from "./carousel";
import { useCarousel } from "./use-carousel";

type Api = ReturnType<typeof useCarousel>;
const holder: { current: Api | null } = { current: null };
/** Latest hook value, captured in an effect so render stays pure. */
const live = {
  get state() {
    return holder.current!.state;
  },
  go: (i: number) => holder.current!.go(i),
  toggleStop: () => holder.current!.toggleStop(),
};

function Fixture() {
  const rootRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const value = useCarousel({ count: 4, rootRef, trackRef });
  useEffect(() => {
    holder.current = value;
  });
  return (
    <div ref={rootRef} data-testid="root">
      <div ref={trackRef} className="hero-track" data-testid="track">
        {[0, 1, 2, 3].map((i) => (
          <section key={i} className="slide" data-testid={`slide-${i}`}>
            {/* eslint-disable-next-line @next/next/no-img-element -- a plain fixture */}
            <img alt="" src={`/s${i}.webp`} loading={i === 0 ? "eager" : "lazy"} />
          </section>
        ))}
      </div>
    </div>
  );
}

function mockMedia({ reduced, phone }: { reduced: boolean; phone: boolean }) {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query.includes("prefers-reduced-motion")
      ? reduced
      : query === "(max-width: 719px)"
        ? phone
        : false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
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
    runEnd(m.root);
    expect(live.state.current).toBe(1);
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

  it("toggleStop stops and restarts autoplay", () => {
    const m = mount({ reduced: false, phone: false });
    act(() => live.toggleStop());
    runEnd(m.root);
    expect(live.state.current).toBe(0);
    act(() => live.toggleStop());
    runEnd(m.root);
    expect(live.state.current).toBe(1);
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

  it("phone: a settled scroll sets current to the nearest slide, the last at the end", () => {
    const m = mount({ reduced: false, phone: true });
    [0, 1, 2, 3].forEach((i) =>
      Object.defineProperty(m.slide(i), "offsetLeft", { configurable: true, value: i * 300 }),
    );
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
});
