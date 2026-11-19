import { act, fireEvent, render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BannerCarousel } from "./banner-carousel";

const SLIDES = [
  { id: "sacuwin", dot: "Sacuwin" },
  { id: "eye", dot: "Eye drops" },
  { id: "rx", dot: "Upload your prescription" },
  { id: "delivery", dot: "Free delivery" },
] as const;

/** The shell around plain slides; the real ones come from the server (banner.tsx). */
const shell = (
  <BannerCarousel slides={SLIDES}>
    {SLIDES.map((s, i) => (
      <div key={s.id} className={i === 0 ? "slide is-current" : "slide"} />
    ))}
  </BannerCarousel>
);

function mockMedia(reduced: boolean) {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query.includes("prefers-reduced-motion") ? reduced : false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
}

/** Rendered and mounted (effects run), after window load. */
function mount(reduced = false) {
  mockMedia(reduced);
  const { container } = render(shell);
  act(() => void window.dispatchEvent(new Event("load")));
  const root = container.querySelector<HTMLElement>("section.hero")!;
  return {
    root,
    track: root.querySelector(".hero-track")!,
    slides: [...root.querySelectorAll(".slide")],
  };
}

const dot = (n: number) => screen.getByRole("button", { name: new RegExp(`^Slide ${n}:`) });

afterEach(() => vi.unstubAllGlobals());

describe("BannerCarousel", () => {
  it("renders no motion or ready state on the server", () => {
    const el = document.createElement("div");
    el.innerHTML = renderToString(shell);
    expect(el.querySelector("section")!.className).toBe("hero wrap");
    expect(el.innerHTML).not.toMatch(/is-auto|is-ready|is-held|is-stopped|no-auto/);
  });

  it("is the carousel region, controls first: play, previous, the dots, next", () => {
    const m = mount();
    const region = screen.getByRole("region", { name: "Offers and services" });
    expect(region).toHaveAttribute("aria-roledescription", "carousel");
    expect(region).toHaveAttribute("data-carousel");
    const focusable = [...m.root.querySelectorAll("button, a[href]")];
    expect(focusable[0]).toHaveAttribute("data-play");
    expect(focusable[0]).toHaveAttribute("aria-label", "Stop automatic slide show");
    for (const name of ["Previous slide", "Next slide"]) {
      expect(screen.getByRole("button", { name })).toHaveAttribute("aria-controls", "hero-track");
    }
    expect(m.track.id).toBe("hero-track");
    expect(m.track.previousElementSibling).toHaveClass("hero-ctl");
    expect(
      [...m.root.querySelectorAll(".hero-dot")].map((d) => d.getAttribute("aria-label")),
    ).toEqual([
      "Slide 1: Sacuwin",
      "Slide 2: Eye drops",
      "Slide 3: Upload your prescription",
      "Slide 4: Free delivery",
    ]);
    expect(dot(1)).toHaveAttribute("aria-current", "true");
    expect(dot(2)).not.toHaveAttribute("aria-current");
    expect(m.root.querySelectorAll(".hero-dot > .dot-fill")).toHaveLength(4);
  });

  it("with motion, starts rotating after load and answers next, the dots, hover and pause", () => {
    const m = mount();
    expect(m.root).toHaveClass("is-ready", "is-auto");
    expect(m.root).not.toHaveClass("no-auto");
    expect(m.track).toHaveAttribute("aria-live", "off");
    fireEvent.click(screen.getByRole("button", { name: "Next slide" }));
    expect(dot(2)).toHaveAttribute("aria-current", "true");
    expect(m.slides[1]).toHaveClass("is-current");
    fireEvent.click(dot(4));
    expect(m.slides[3]).toHaveClass("is-current");
    fireEvent.click(screen.getByRole("button", { name: "Previous slide" }));
    expect(dot(3)).toHaveAttribute("aria-current", "true");
    fireEvent.pointerEnter(m.root, { pointerType: "mouse" });
    expect(m.root).toHaveClass("is-held");
    expect(m.track).toHaveAttribute("aria-live", "polite");
    fireEvent.click(screen.getByRole("button", { name: "Stop automatic slide show" }));
    expect(m.root).toHaveClass("is-auto", "is-stopped");
    expect(screen.getByRole("button", { name: "Start automatic slide show" })).toHaveAttribute(
      "data-play",
    );
  });

  it("under reduced motion never rotates and hides the pause control (no-auto)", () => {
    const m = mount(true);
    expect(m.root).toHaveClass("is-ready", "no-auto");
    expect(m.root).not.toHaveClass("is-auto");
    expect(m.track).toHaveAttribute("aria-live", "polite");
  });
});
