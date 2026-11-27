import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createFilm } from "./engine";

type IOInstance = {
  cb: IntersectionObserverCallback;
  opts?: IntersectionObserverInit;
  disconnect: () => void;
};
let ios: IOInstance[];
let ros: { disconnect: () => void; cb: () => void }[];
let rafQueue: FrameRequestCallback[];
let scrollY = 0;

function setBox(el: Element, o: { top?: number; height?: number; offsetHeight?: number }) {
  el.getBoundingClientRect = () => ({ top: o.top ?? 0, height: o.height ?? 0 }) as DOMRect;
  if (o.offsetHeight !== undefined)
    Object.defineProperty(el, "offsetHeight", { value: o.offsetHeight, configurable: true });
}

function flushRaf() {
  const q = rafQueue;
  rafQueue = [];
  q.forEach((f) => f(0));
}

function build() {
  document.body.innerHTML = `
    <header class="store-head" style="color: red"></header>
    <nav class="catbar"></nav>
    <div id="home">
      <section id="areas" data-act="pass"><div class="tile" data-in=".02 .25 out"><img src="/a.png" loading="lazy"></div></section>
      <section id="how" data-act="pin">
        <div class="stage">
          <div class="step"></div><div class="step"></div><div class="step"></div>
          <div class="perf-fill" data-in="0 .9"></div>
          <div class="late" data-in=".95 1" data-out=".97 1"></div>
        </div>
      </section>
      <section id="close" data-act="pin" data-lead><div class="stage"></div></section>
    </div>`;
  const q = (s: string) => document.querySelector<HTMLElement>(s)!;
  setBox(q("#areas"), { top: 1000, height: 800 });
  setBox(q("#how"), { top: 0, offsetHeight: 2700 });
  setBox(q("#how .stage"), { offsetHeight: 900 });
  setBox(q("#close"), { top: 6000, offsetHeight: 1890 });
  setBox(q("#close .stage"), { offsetHeight: 900 });
  return q("#home");
}

beforeEach(() => {
  vi.useFakeTimers();
  ios = [];
  ros = [];
  rafQueue = [];
  scrollY = 0;
  vi.stubGlobal("innerHeight", 900);
  Object.defineProperty(window, "scrollY", { get: () => scrollY, configurable: true });
  vi.stubGlobal("requestAnimationFrame", (f: FrameRequestCallback) => rafQueue.push(f));
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      inst: IOInstance;
      constructor(cb: IntersectionObserverCallback, opts?: IntersectionObserverInit) {
        this.inst = { cb, opts, disconnect: vi.fn() };
        ios.push(this.inst);
      }
      observe(t: Element) {
        this.inst.cb(
          [{ target: t, isIntersecting: true } as IntersectionObserverEntry],
          this as never,
        );
      }
      disconnect() {
        this.inst.disconnect();
      }
    },
  );
  vi.stubGlobal(
    "ResizeObserver",
    class {
      inst: (typeof ros)[number];
      constructor(cb: () => void) {
        this.inst = { disconnect: vi.fn(), cb };
        ros.push(this.inst);
      }
      observe() {}
      disconnect() {
        this.inst.disconnect();
      }
    },
  );
  window.scrollTo = vi.fn() as never;
  history.replaceState({}, "", "/");
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("createFilm with film on", () => {
  it("adds exactly one passive scroll listener and batches frames", () => {
    const add = vi.spyOn(window, "addEventListener") as unknown as { mock: { calls: unknown[][] } };
    const raf = vi.fn((f: FrameRequestCallback) => rafQueue.push(f));
    vi.stubGlobal("requestAnimationFrame", raf);
    createFilm(build(), { film: true });
    const scrolls = add.mock.calls.filter((c) => c[0] === "scroll");
    expect(scrolls).toHaveLength(1);
    expect(scrolls[0]![2]).toEqual({ passive: true });
    flushRaf();
    raf.mockClear();
    for (let i = 0; i < 10; i++) window.dispatchEvent(new Event("scroll"));
    expect(raf).toHaveBeenCalledTimes(1);
  });

  it("writes --ti, toggles the active step and skips unchanged values", () => {
    const root = build();
    createFilm(root, { film: true });
    flushRaf();
    scrollY = 900;
    window.dispatchEvent(new Event("scroll"));
    flushRaf();
    const fill = root.querySelector<HTMLElement>(".perf-fill")!;
    expect(fill.style.getPropertyValue("--ti")).toBe("0.5556");
    const steps = [...root.querySelectorAll(".step")];
    expect(steps.map((s) => s.classList.contains("is-active"))).toEqual([false, true, false]);
    expect(root.querySelector("#areas")!.classList.contains("live")).toBe(true);
    const set = vi.spyOn(CSSStyleDeclaration.prototype, "setProperty");
    window.dispatchEvent(new Event("scroll"));
    flushRaf();
    expect(set).not.toHaveBeenCalled();
  });

  it("writes each item's --ti and --to only when that item's value changed", () => {
    const root = build();
    createFilm(root, { film: true });
    flushRaf();
    const late = root.querySelector<HTMLElement>(".late")!;
    const fill = root.querySelector<HTMLElement>(".perf-fill")!;
    const lateSet = vi.spyOn(late.style, "setProperty");
    const fillSet = vi.spyOn(fill.style, "setProperty");
    scrollY = 900;
    window.dispatchEvent(new Event("scroll"));
    flushRaf();
    scrollY = 1000;
    window.dispatchEvent(new Event("scroll"));
    flushRaf();
    expect(fillSet).toHaveBeenCalledTimes(2);
    expect(lateSet).not.toHaveBeenCalled();
  });

  it("decodes each image once, however often its act re-enters", () => {
    const root = build();
    const img = root.querySelector<HTMLImageElement>("img")!;
    const decode = vi.fn(() => Promise.resolve());
    img.decode = decode;
    createFilm(root, { film: true });
    const areas = root.querySelector("#areas")!;
    const cb = ios[0]!.cb;
    cb([{ target: areas, isIntersecting: false } as IntersectionObserverEntry], {} as never);
    cb([{ target: areas, isIntersecting: true } as IntersectionObserverEntry], {} as never);
    expect(decode).toHaveBeenCalledTimes(1);
  });

  it("does not measure again for the ResizeObserver's first report", () => {
    const root = build();
    createFilm(root, { film: true });
    const how = root.querySelector("#how")!;
    const spy = vi.spyOn(how, "getBoundingClientRect");
    ros[0]!.cb();
    vi.advanceTimersByTime(200);
    expect(spy).not.toHaveBeenCalled();
    ros[0]!.cb();
    vi.advanceTimersByTime(120);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("marks the root is-running while it runs and removes it on destroy", () => {
    const root = build();
    expect(root.classList.contains("is-running")).toBe(false);
    const film = createFilm(root, { film: true });
    expect(root.classList.contains("is-running")).toBe(true);
    film.destroy();
    expect(root.classList.contains("is-running")).toBe(false);
  });

  it("marks the root measuring only while measuring", () => {
    const root = build();
    const seen: boolean[] = [];
    const home = root.querySelector("#how")!;
    const orig = home.getBoundingClientRect;
    home.getBoundingClientRect = () => {
      seen.push(root.classList.contains("measuring"));
      return orig.call(home);
    };
    createFilm(root, { film: true });
    expect(seen).toContain(true);
    expect(root.classList.contains("measuring")).toBe(false);
  });

  it("observes with a 100% vertical margin and eager-loads images on enter", () => {
    const root = build();
    const img = root.querySelector<HTMLImageElement>("img")!;
    const decode = vi.fn(() => Promise.resolve());
    img.decode = decode;
    createFilm(root, { film: true });
    expect(ios[0]!.opts?.rootMargin).toBe("100% 0px");
    expect(img.loading).toBe("eager");
    expect(decode).toHaveBeenCalled();
  });

  it("scrolls to the ?p= deep link", () => {
    history.replaceState({}, "", "/?p=3:0.5");
    createFilm(build(), { film: true });
    expect(window.scrollTo).toHaveBeenCalledWith(0, 900);
  });

  it("remeasures after a 120 ms debounce", () => {
    const root = build();
    createFilm(root, { film: true });
    const how = root.querySelector("#how")!;
    const spy = vi.spyOn(how, "getBoundingClientRect");
    window.dispatchEvent(new Event("resize"));
    window.dispatchEvent(new Event("resize"));
    vi.advanceTimersByTime(119);
    expect(spy).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("destroy removes the very handlers it added, cancels the frame and clears the timer", () => {
    const add = vi.spyOn(window, "addEventListener") as unknown as { mock: { calls: unknown[][] } };
    const remove = vi.spyOn(window, "removeEventListener") as unknown as {
      mock: { calls: unknown[][] };
    };
    const root = build();
    const film = createFilm(root, { film: true });
    flushRaf();
    window.dispatchEvent(new Event("scroll"));
    window.dispatchEvent(new Event("resize"));
    const how = root.querySelector("#how")!;
    const spy = vi.spyOn(how, "getBoundingClientRect");
    film.destroy();
    for (const name of ["scroll", "resize"]) {
      const added = add.mock.calls.find((c) => c[0] === name)![1];
      expect(remove.mock.calls.some((c) => c[0] === name && c[1] === added)).toBe(true);
    }
    expect(cancelAnimationFrame).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(500);
    expect(spy).not.toHaveBeenCalled();
    expect(ios[0]!.disconnect).toHaveBeenCalled();
    expect(ros[0]!.disconnect).toHaveBeenCalled();
  });

  it("never touches the header or the category bar (C23)", () => {
    build();
    const root = document.querySelector<HTMLElement>("#home")!;
    const sibs = [".store-head", ".catbar"].map((s) => document.querySelector(s)!);
    const before = sibs.map((e) => e.outerHTML);
    createFilm(root, { film: true });
    for (const y of [0, 450, 900, 1800, 5000]) {
      scrollY = y;
      window.dispatchEvent(new Event("scroll"));
      flushRaf();
    }
    expect(sibs.map((e) => e.outerHTML)).toEqual(before);
    expect(sibs[0]!.className).toBe("store-head");
  });
});

describe("createFilm with film off", () => {
  it("is a full no-op: no listener, observer, style, class, scroll or deep link", () => {
    history.replaceState({}, "", "/?p=3:0.5");
    const add = vi.spyOn(window, "addEventListener") as unknown as { mock: { calls: unknown[][] } };
    const root = build();
    const before = document.body.innerHTML;
    const film = createFilm(root, { film: false });
    expect(add.mock.calls).toEqual([]);
    expect(ios).toHaveLength(0);
    expect(ros).toHaveLength(0);
    expect(rafQueue).toHaveLength(0);
    expect(window.scrollTo).not.toHaveBeenCalled();
    expect(document.body.innerHTML).toBe(before);
    expect(() => film.destroy()).not.toThrow();
    expect(cancelAnimationFrame).not.toHaveBeenCalled();
  });
});
