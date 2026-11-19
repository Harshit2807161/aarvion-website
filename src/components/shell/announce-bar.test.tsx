import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ANNOUNCE_MS, ANNOUNCEMENTS, AnnounceBar } from "./announce-bar";

/** matchMedia where `(max-width: 720px)` is `phone` and `prefers-reduced-motion` is `reduce`. */
function mockMedia({ phone, reduce }: { phone: boolean; reduce: boolean }) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn((q: string) => ({
      matches: q.includes("max-width") ? phone : q.includes("reduced-motion") ? reduce : false,
      media: q,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
}

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
});
