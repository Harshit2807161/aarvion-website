"use client";

import { useRef, type ReactNode } from "react";
import { Icon } from "@/components/base/icon";
import { cn } from "@/lib/cn";
import type { BannerSlide } from "@/lib/catalogue/banners";
import { liveMode, playLabel } from "./carousel";
import { useCarousel } from "./use-carousel";
import "./banner.css";

/**
 * The banner carousel's client shell (index.src.html 61–118): the controls, then the track that
 * holds the server-rendered slides (`children`, one `.slide` per entry of `slides`, same order).
 *
 * The controls come first in the DOM, so the rotation control leads the tab order (APG carousel
 * pattern); CSS puts them under the slides. `useCarousel` owns each slide's `is-current`,
 * `is-leaving`, `inert` and image `loading`, so nothing here renders them. The root's state
 * classes need browser state that the hook reads after mount, so the server renders none:
 * - `is-ready` (window load): shows the controls;
 * - `is-auto` (motion allowed): runs the current dot's 6 s `dot-run` fill, whose end advances;
 * - `is-held` (hover, focus, touch, hidden tab, off screen) and `is-stopped` (the user's pause)
 *   pause that fill where it stands;
 * - `no-auto` (reduced motion): hides the pause control; nothing rotates.
 *
 * The track's `aria-live` is "off" while it rotates and "polite" otherwise, so a slide the user
 * picks is read out (APG carousel pattern, as the plan specifies). Spoken feedback still goes
 * through `announce()`.
 */
export function BannerCarousel({
  slides,
  children,
}: {
  slides: readonly Pick<BannerSlide, "id" | "dot">[];
  children: ReactNode;
}) {
  const rootRef = useRef<HTMLElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const { state, go, next, prev, toggleStop } = useCarousel({
    count: slides.length,
    rootRef,
    trackRef,
  });
  return (
    <section
      ref={rootRef}
      className={cn(
        "hero wrap",
        state.ready && "is-ready",
        state.ready && state.motion && "is-auto",
        state.holds.length > 0 && "is-held",
        state.motion && state.stopped && "is-stopped",
        !state.motion && "no-auto",
      )}
      aria-roledescription="carousel"
      aria-label="Offers and services"
      data-carousel
    >
      <div className="hero-ctl">
        <button
          className="hero-btn hero-play"
          type="button"
          data-play
          aria-label={playLabel(state)}
          onClick={toggleStop}
        >
          <Icon name="hold" />
          <Icon name="play" />
        </button>
        <button
          className="hero-btn"
          type="button"
          data-prev
          aria-controls="hero-track"
          aria-label="Previous slide"
          onClick={prev}
        >
          <Icon name="back" />
        </button>
        <div className="hero-dots">
          {slides.map((s, i) => (
            <button
              key={s.id}
              className="hero-dot"
              type="button"
              aria-current={i === state.current || undefined}
              aria-label={`Slide ${i + 1}: ${s.dot}`}
              onClick={() => go(i)}
            >
              <span className="dot-fill" />
            </button>
          ))}
        </div>
        <button
          className="hero-btn"
          type="button"
          data-next
          aria-controls="hero-track"
          aria-label="Next slide"
          onClick={next}
        >
          <Icon name="arrow" />
        </button>
      </div>
      <div ref={trackRef} className="hero-track" id="hero-track" aria-live={liveMode(state)}>
        {children}
      </div>
    </section>
  );
}
