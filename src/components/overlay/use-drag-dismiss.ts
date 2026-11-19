"use client";

import { type PointerEvent as ReactPointerEvent, type RefObject, useRef } from "react";
import { dragOffset, shouldDismiss } from "./drag";

/** Below this width the overlay is a bottom sheet (matches the 639px query in overlay.css). */
const PHONE_QUERY = "(max-width: 639px)";
/** Pointers that start on these keep their own behaviour (Close, links, inputs). */
const INTERACTIVE = "button, a, input";
const SNAP_BACK = "transform 220ms var(--ease-drawer)";

type Drag = { id: number; startY: number; startedAt: number };

/**
 * Drag-to-dismiss for the phone bottom sheet. Spread the returned handlers on the grab area
 * (the sheet head); `panelRef` is the panel that moves. The panel follows the finger through
 * an inline transform (no re-render per move); the `is-dragging` class switches off its CSS
 * animation meanwhile. Past the thresholds in drag.ts it calls `onDismiss`, and the panel's
 * close animation then continues from where the finger left it; otherwise it snaps back.
 * Inactive above 639px. Browser state (matchMedia, performance.now) is read inside handlers only.
 */
export function useDragDismiss({
  panelRef,
  onDismiss,
}: {
  panelRef: RefObject<HTMLElement | null>;
  onDismiss: () => void;
}) {
  const drag = useRef<Drag | null>(null);

  function onPointerDown(e: ReactPointerEvent<HTMLElement>) {
    const panel = panelRef.current;
    if (!panel || e.button !== 0) return;
    if (!window.matchMedia(PHONE_QUERY).matches) return;
    if ((e.target as Element).closest(INTERACTIVE)) return;
    drag.current = { id: e.pointerId, startY: e.clientY, startedAt: performance.now() };
    panel.style.transition = "";
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
    panel.classList.remove("is-dragging");
    if (dismiss) {
      onDismiss();
      return;
    }
    panel.style.transition = SNAP_BACK;
    panel.style.transform = "";
    panel.addEventListener(
      "transitionend",
      () => {
        panel.style.transition = "";
      },
      { once: true },
    );
  }

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp: (e: ReactPointerEvent<HTMLElement>) => finish(e, false),
    onPointerCancel: (e: ReactPointerEvent<HTMLElement>) => finish(e, true),
  };
}
