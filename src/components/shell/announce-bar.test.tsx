import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ANNOUNCE_MS, ANNOUNCEMENTS, AnnounceBar } from "./announce-bar";

type Listener = () => void;
const listeners: { phone: Listener[]; reduce: Listener[] } = { phone: [], reduce: [] };
const media = { phone: false, reduce: false };

/** matchMedia where `(max-width: 720px)` is `phone` and `prefers-reduced-motion` is `reduce`. */
function mockMedia(initial: { phone: boolean; reduce: boolean }) {
  Object.assign(media, initial);
  listeners.phone = [];
  listeners.reduce = [];
  vi.stubGlobal(
    "matchMedia",
    vi.fn((q: string) => {
      const key = q.includes("max-width") ? "phone" : "reduce";
      return {
        get matches() {
          return media[key];
        },
        media: q,
        addEventListener: (_: string, l: Listener) => listeners[key].push(l),
        removeEventListener: (_: string, l: Listener) => {
          listeners[key] = listeners[key].filter((x) => x !== l);
        },
      };
    }),
  );
}

/** Flip a media query and fire its `change` listeners, as the browser does. */
const changeMedia = (key: "phone" | "reduce", value: boolean) => {
  media[key] = value;
  act(() => listeners[key].forEach((l) => l()));
};

const setHidden = (hidden: boolean) =>
  Object.defineProperty(document, "hidden", { configurable: true, value: hidden });

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  setHidden(false);
});

const notices = (c: HTMLElement) => [...c.querySelectorAll(".ann")];

describe("AnnounceBar", () => {
  it("has the three notices in a data-announce wrapper", () => {
    mockMedia({ phone: false, reduce: false });
    const { container } = render(<AnnounceBar />);
    expect(
      container.querySelector("div.announce[data-announce] > p.wrap.announce-in"),
    ).not.toBeNull();
    expect(notices(container).map((n) => n.textContent)).toEqual([...ANNOUNCEMENTS]);
    expect(ANNOUNCE_MS).toBe(5000);
  });

  it("shows every notice on desktop and does not rotate", () => {
    mockMedia({ phone: false, reduce: false });
    const { container } = render(<AnnounceBar />);
    act(() => void vi.advanceTimersByTime(10_000));
    expect(notices(container)).toHaveLength(3);
    expect(container.querySelector(".is-rotating")).toBeNull();
    expect(container.querySelector(".is-on")).toBeNull();
  });

  it("cross-fades one notice every 5 s on a phone with motion", () => {
    mockMedia({ phone: true, reduce: false });
    const { container } = render(<AnnounceBar />);
    expect(container.querySelector(".announce.is-rotating")).not.toBeNull();
    expect(notices(container)[0]).toHaveClass("is-on");
    act(() => void vi.advanceTimersByTime(ANNOUNCE_MS));
    expect(notices(container)[0]).not.toHaveClass("is-on");
    expect(notices(container)[1]).toHaveClass("is-on");
  });

  it("skips ticks while the tab is hidden", () => {
    mockMedia({ phone: true, reduce: false });
    const { container } = render(<AnnounceBar />);
    setHidden(true);
    act(() => void vi.advanceTimersByTime(2 * ANNOUNCE_MS));
    expect(notices(container)[0]).toHaveClass("is-on");
    expect(notices(container)[1]).not.toHaveClass("is-on");
  });

  it("stays on the first notice on a phone under reduced motion", () => {
    mockMedia({ phone: true, reduce: true });
    const { container } = render(<AnnounceBar />);
    act(() => void vi.advanceTimersByTime(10_000));
    expect(container.querySelector(".is-rotating")).toBeNull();
    expect(container.querySelector(".is-on")).toBeNull();
  });

  it("starts and stops rotating when the phone media query changes", () => {
    mockMedia({ phone: false, reduce: false });
    const { container } = render(<AnnounceBar />);
    expect(container.querySelector(".is-rotating")).toBeNull();
    changeMedia("phone", true);
    expect(container.querySelector(".announce.is-rotating")).not.toBeNull();
    act(() => void vi.advanceTimersByTime(ANNOUNCE_MS));
    expect(notices(container)[1]).toHaveClass("is-on");
    changeMedia("phone", false);
    expect(container.querySelector(".is-rotating")).toBeNull();
    expect(container.querySelector(".is-on")).toBeNull();
  });

  it("stops rotating when reduced motion is switched on", () => {
    mockMedia({ phone: true, reduce: false });
    const { container } = render(<AnnounceBar />);
    changeMedia("reduce", true);
    expect(container.querySelector(".is-rotating")).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("clears its interval and listeners on unmount", () => {
    mockMedia({ phone: true, reduce: false });
    const { unmount } = render(<AnnounceBar />);
    expect(vi.getTimerCount()).toBe(1);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
    expect(listeners.phone).toHaveLength(0);
    expect(listeners.reduce).toHaveLength(0);
  });
});
