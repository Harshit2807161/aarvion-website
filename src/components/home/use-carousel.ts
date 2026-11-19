"use client";

import { useCallback, useEffect, useReducer, useRef, type RefObject } from "react";
import {
  LEAVE_MS,
  PHONE_QUERY,
  TOUCH_RESUME_MS,
  carouselReducer,
  initialCarousel,
  type CarouselState,
  type Hold,
} from "./carousel";

const REDUCED_QUERY = "(prefers-reduced-motion: reduce)";
const SETTLE_MS = 90;

type Options = {
  count: number;
  rootRef: RefObject<HTMLElement | null>;
  trackRef: RefObject<HTMLElement | null>;
};

/**
 * Drives the home banner carousel. Markup (slides, dots, controls) is rendered by the component;
 * this hook owns the autoplay clock holds and the imperative slide DOM state: `is-current`,
 * `is-leaving`, `inert` and the lazy-to-eager image switch. React must not render those on the
 * slides. Task 19: hide the pause control when `!state.motion`. Autoplay itself is CSS: the current dot's `dot-run` animation ends and advances.
 *
 * Browser APIs are read in effects only, so server and first client render agree. Until the
 * reduced-motion preference is read, `ready` is false and nothing autoplays.
 */
export function useCarousel({ count, rootRef, trackRef }: Options) {
  const [state, dispatch] = useReducer(carouselReducer, undefined, () => initialCarousel(count, true));
  const phone = useRef(false);
  const prev = useRef(0);
  const leaveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const stateRef = useRef<CarouselState>(state);
  stateRef.current = state;

  const slidesOf = useCallback(
    () => Array.from(trackRef.current?.querySelectorAll<HTMLElement>(".slide") ?? []),
    [trackRef],
  );
  const left = useCallback(
    (i: number) => {
      const slides = slidesOf();
      return (slides[i]?.offsetLeft ?? 0) - (slides[0]?.offsetLeft ?? 0);
    },
    [slidesOf],
  );
  const scrollToSlide = useCallback(
    (i: number) => {
      const track = trackRef.current;
      if (!track || typeof track.scrollTo !== "function") return;
      track.scrollTo({ left: left(i), behavior: stateRef.current.motion ? "smooth" : "auto" });
    },
    [trackRef, left],
  );

  // Listeners and one-off environment reads.
  useEffect(() => {
    const root = rootRef.current;
    const track = trackRef.current;
    if (!root || !track) return;
    const hold = (why: Hold, on: boolean) => dispatch({ type: "hold", why, on });
    const cleanups: Array<() => void> = [];
    const listen = <T extends EventTarget>(t: T, type: string, fn: (e: never) => void, opts?: AddEventListenerOptions) => {
      t.addEventListener(type, fn as EventListener, opts);
      cleanups.push(() => t.removeEventListener(type, fn as EventListener, opts));
    };

    const reduced = window.matchMedia(REDUCED_QUERY);
    const phoneMq = window.matchMedia(PHONE_QUERY);
    phone.current = phoneMq.matches;
    dispatch({ type: "motion", on: !reduced.matches });
    listen(reduced, "change", () => dispatch({ type: "motion", on: !reduced.matches }));
    listen(phoneMq, "change", () => {
      phone.current = phoneMq.matches;
      applyDom(stateRef.current.current, stateRef.current.current, false);
      if (phone.current) track.scrollLeft = left(stateRef.current.current);
    });

    listen(root, "pointerenter", (e: PointerEvent) => e.pointerType === "mouse" && hold("hover", true));
    listen(root, "pointerleave", (e: PointerEvent) => e.pointerType === "mouse" && hold("hover", false));
    listen(root, "focusin", () => hold("focus", true));
    listen(root, "focusout", (e: FocusEvent) => {
      if (!root.contains(e.relatedTarget as Node | null)) hold("focus", false);
    });

    let touchTimer: ReturnType<typeof setTimeout> | undefined;
    listen(track, "pointerdown", (e: PointerEvent) => {
      if (e.pointerType === "mouse") return;
      clearTimeout(touchTimer);
      hold("touch", true);
    });
    const untouch = (e: PointerEvent) => {
      if (e.pointerType === "mouse") return;
      clearTimeout(touchTimer);
      touchTimer = setTimeout(() => hold("touch", false), TOUCH_RESUME_MS);
    };
    listen(track, "pointerup", untouch);
    listen(track, "pointercancel", untouch);
    cleanups.push(() => clearTimeout(touchTimer));

    listen(document, "visibilitychange", () => hold("hidden", document.hidden));
    if (typeof IntersectionObserver !== "undefined") {
      const io = new IntersectionObserver((entries) => {
        const last = entries[entries.length - 1];
        if (last) hold("away", !last.isIntersecting);
      });
      io.observe(track);
      cleanups.push(() => io.disconnect());
    }

    listen(root, "animationend", (e: AnimationEvent) => {
      if (e.animationName === "dot-run") dispatch({ type: "tickEnd" });
    });

    // Phones: the scroll position is the truth; a settled scroll picks the nearest slide.
    let settle: ReturnType<typeof setTimeout> | undefined;
    listen(
      track,
      "scroll",
      () => {
        if (!phone.current) return;
        clearTimeout(settle);
        settle = setTimeout(() => {
          const slides = slidesOf();
          const x = track.scrollLeft;
          const max = track.scrollWidth - track.clientWidth;
          let nearest = 0;
          slides.forEach((_, k) => {
            if (Math.abs(left(k) - x) < Math.abs(left(nearest) - x)) nearest = k;
          });
          if (x >= max - 2) nearest = slides.length - 1;
          dispatch({ type: "go", index: nearest });
        }, SETTLE_MS);
      },
      { passive: true },
    );
    cleanups.push(() => clearTimeout(settle));

    const onLoad = () => {
      slidesOf().forEach((s, k) => {
        if (k > 0) s.querySelectorAll("img").forEach((img) => img.setAttribute("loading", "eager"));
      });
      dispatch({ type: "ready" });
    };
    if (document.readyState === "complete") onLoad();
    else listen(window, "load", onLoad);

    applyDom(0, 0, false);

    return () => cleanups.forEach((fn) => fn());
    // eslint-disable-next-line react-hooks/exhaustive-deps -- applyDom is a stable closure over refs
  }, [rootRef, trackRef, slidesOf, left]);

  // Marks the slides: is-current, inert (desktop only) and the outgoing is-leaving.
  function applyDom(from: number, to: number, animate: boolean) {
    const slides = slidesOf();
    clearTimeout(leaveTimer.current);
    slides.forEach((s, k) => {
      s.classList.toggle("is-current", k === to);
      s.classList.remove("is-leaving");
      s.inert = !phone.current && k !== to;
    });
    if (animate && !phone.current && from !== to && slides[from]) {
      const out = slides[from];
      out.classList.add("is-leaving");
      leaveTimer.current = setTimeout(() => out.classList.remove("is-leaving"), stateRef.current.motion ? LEAVE_MS : 0);
    }
  }

  useEffect(() => {
    const from = prev.current;
    prev.current = state.current;
    if (from === state.current) return;
    applyDom(from, state.current, true);
    const track = trackRef.current;
    if (phone.current && track && Math.abs(track.scrollLeft - left(state.current)) > 2) scrollToSlide(state.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.current]);

  useEffect(() => () => clearTimeout(leaveTimer.current), []);

  const go = useCallback(
    (i: number) => {
      dispatch({ type: "go", index: i });
      if (phone.current) scrollToSlide(((i % count) + count) % count);
    },
    [count, scrollToSlide],
  );
  const next = useCallback(() => dispatch({ type: "next" }), []);
  const prevSlide = useCallback(() => dispatch({ type: "prev" }), []);
  const toggleStop = useCallback(() => dispatch({ type: "toggleStop" }), []);

  return { state, go, next, prev: prevSlide, toggleStop };
}
