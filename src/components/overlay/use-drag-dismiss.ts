"use client";

import { type PointerEvent as ReactPointerEvent, type RefObject, useRef } from "react";
import { prefersReducedMotion } from "@/lib/motion";
import { dragOffset, shouldDismiss } from "./drag";

/** Below this width the overlay is a bottom sheet (matches the 639px query in overlay.css). */
const PHONE_QUERY = "(max-width: 639px)";
/** Pointers that start on these keep their own behaviour (Close, links, inputs). */
const INTERACTIVE = "button, a, input";
const SNAP_BACK = "transform 220ms var(--ease-drawer)";
/** transitionend does not fire if nothing moved, so the snap-back also settles on a timer. */
const SNAP_BACK_FALLBACK_MS = 280;

type Drag = { id: number; startY: number; startedAt: number };

/**
 * Drag-to-dismiss for the phone bottom sheet. Spread the returned handlers on the grab area
 * (the sheet head, which does not scroll; never on the panel, where a drag would fight the
 * scrolling body). `panelRef` is the panel that moves. The panel follows the finger through
 * an inline transform (no re-render per move); the `is-dragging` class holds its CSS open
 * animation off (it would otherwise override the inline transform). The class is never removed
 * while the panel is open, even after a snap-back or a plain tap on the grip: removing it would
 * re-arm the open animation and replay the entrance. Past the thresholds in drag.ts it calls `onDismiss`, and the panel's close
 * animation then continues from where the finger left it. Otherwise, or if `onDismiss` did not
 * close it, the panel snaps back (only its inline transition is cleared afterwards).
 * A second pointer is ignored while one is dragging. Inactive above 639px. Browser state
 * (matchMedia, performance.now) is read inside handlers only.
 */
export function useDragDismiss({
  panelRef,
  onDismiss,
}: {
  panelRef: RefObject<HTMLElement | null>;
  onDismiss: () => void;
}) {
  const drag = useRef<Drag | null>(null);
  /** Finishes a snap-back early (clears its timer and listener); null when none is running. */
  const settle = useRef<(() => void) | null>(null);

  function snapBack(panel: HTMLElement) {
    settle.current?.();
    const timer: { id?: ReturnType<typeof setTimeout> } = {};
    const done = () => {
      clearTimeout(timer.id);
      panel.removeEventListener("transitionend", onEnd);
      // Only the inline transition goes. `is-dragging` stays for as long as the panel is open:
      // overlay.css holds the open animation off with it, and removing it would re-arm that
      // animation, replaying the entrance from translateY(100%).
      panel.style.transition = "";
      settle.current = null;
    };
    const onEnd = (e: TransitionEvent) => {
      if (e.target === panel && e.propertyName === "transform") done();
    };
    const moved = panel.style.transform !== "";
    if (!moved || prefersReducedMotion()) {
      panel.style.transform = "";
      done();
      return;
    }
    timer.id = setTimeout(done, SNAP_BACK_FALLBACK_MS);
    settle.current = done;
    panel.addEventListener("transitionend", onEnd);
    panel.style.transition = SNAP_BACK;
    panel.style.transform = "";
  }

  function onPointerDown(e: ReactPointerEvent<HTMLElement>) {
    const panel = panelRef.current;
    if (!panel || e.button !== 0 || drag.current) return;
    if (!window.matchMedia(PHONE_QUERY).matches) return;
    if ((e.target as Element).closest(INTERACTIVE)) return;
    settle.current?.();
    drag.current = { id: e.pointerId, startY: e.clientY, startedAt: performance.now() };
    panel.classList.add("is-dragging");
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Capture is a nicety (moves outside the head keep arriving); the drag works without it.
    }
  }

  function onPointerMove(e: ReactPointerEvent<HTMLElement>) {
    const d = drag.current;
    const panel = panelRef.current;
    if (!d || !panel || e.pointerId !== d.id) return;
    panel.style.transform = `translateY(${dragOffset(e.clientY - d.startY)}px)`;
  }

  function finish(e: ReactPointerEvent<HTMLElement>, cancelled: boolean) {
    const d = drag.current;
    const panel = panelRef.current;
    if (!d || e.pointerId !== d.id) return;
    drag.current = null;
    if (!panel) return;
    const dy = e.clientY - d.startY;
    const dismiss =
      !cancelled &&
      shouldDismiss(dy, panel.getBoundingClientRect().height, performance.now() - d.startedAt);
    if (!dismiss) {
      snapBack(panel);
      return;
    }
    // is-dragging stays on: overlay.css only holds the *open* animation off, so the close
    // animation takes over from the dragged offset once Radix flips data-state.
    onDismiss();
    // If the parent refused to close, the panel is still open a frame later: snap back.
    requestAnimationFrame(() => {
      if (panel.isConnected && panel.getAttribute("data-state") === "open") snapBack(panel);
    });
  }

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp: (e: ReactPointerEvent<HTMLElement>) => finish(e, false),
    onPointerCancel: (e: ReactPointerEvent<HTMLElement>) => finish(e, true),
    // Capture lost without a pointerup (capture failed, or the browser took the gesture).
    onLostPointerCapture: (e: ReactPointerEvent<HTMLElement>) => finish(e, true),
  };
}
