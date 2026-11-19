/**
 * Pure maths for the phone bottom sheet's drag-to-dismiss (DESIGN.md "Drawers, Dialogs and
 * Bottom Sheets"). Kept free of the DOM so the thresholds are unit-testable.
 */

/** A drag past this fraction of the panel height dismisses it. */
export const DISMISS_FRACTION = 0.28;
/** A fast flick must also travel at least this many px before it counts. */
export const DISMISS_MIN_PX = 24;
/** Flick speed in px per ms. */
export const DISMISS_VELOCITY = 0.45;

/** Whether a downward drag of `dy` px over `ms` ms, on a panel `height` px tall, dismisses. */
export function shouldDismiss(dy: number, height: number, ms: number): boolean {
  return (
    dy > height * DISMISS_FRACTION ||
    (dy > DISMISS_MIN_PX && dy / Math.max(1, ms) > DISMISS_VELOCITY)
  );
}

/** Panel offset for a finger offset: 1:1 downward, square-root rubber band upward. */
export function dragOffset(dy: number): number {
  return dy >= 0 ? dy : -Math.sqrt(-dy) * 2;
}
