"use client";

import { type ReactNode, type RefObject, useRef } from "react";
import { Dialog, DialogClose, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Icon } from "@/components/base/icon";
import { cn } from "@/lib/cn";
import { useDragDismiss } from "./use-drag-dismiss";

export type OverlayProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** `dialog` is centred; `side` is the right-hand drawer. Both are bottom sheets below 640px. */
  variant: "dialog" | "side";
  /** The accessible name of the overlay. */
  title: ReactNode;
  /** Optional count shown after the title (cart items, search results). */
  count?: ReactNode;
  /** Accessible name of the Close button (callers pass translated, context-aware text). */
  closeLabel: string;
  /** Element to focus on open; defaults to the first focusable element (Close). */
  initialFocus?: RefObject<HTMLElement | null>;
  /**
   * Element to focus when the overlay closes. By default focus returns to whatever had focus when
   * it opened, but Safari and Firefox on macOS do not focus a button on mouse click, so for a
   * click-opened overlay that is `document.body` and focus would be lost. Pass the opener's ref
   * (or another stable control) where the overlay is opened by mouse.
   */
  returnFocusTo?: RefObject<HTMLElement | null>;
  /** Sticky foot under the scrolling body (totals, primary actions). */
  footer?: ReactNode;
  children: ReactNode;
};

/**
 * The storefront's dialog and side sheet (login, search, mobile menu, cart). Radix supplies the
 * focus trap, Escape, scroll lock, aria-hidden siblings and ARIA wiring; this component supplies
 * the look (src/styles/overlay.css), the phone bottom sheet and its drag-to-dismiss, and focus
 * return to whatever opened it (or `returnFocusTo`), which Radix only does for its own Trigger.
 * The opener is read from `document.activeElement` on open, which is `body` for a mouse click
 * on Safari and Firefox/macOS; see `returnFocusTo`.
 */
export function Overlay({
  open,
  onOpenChange,
  variant,
  title,
  count,
  closeLabel,
  initialFocus,
  returnFocusTo,
  footer,
  children,
}: OverlayProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const grab = useDragDismiss({ panelRef, onDismiss: () => onOpenChange(false) });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        overlayClassName="sheet-scrim"
        ref={panelRef}
        className={cn("sheet-panel", `sheet--${variant}`)}
        aria-describedby={undefined}
        // Radix hides the rest of the page but does not set aria-modal itself.
        aria-modal="true"
        onOpenAutoFocus={(e) => {
          // Focus has not moved yet, so this is the control that opened the overlay.
          opener.current = document.activeElement as HTMLElement | null;
          if (initialFocus?.current) {
            e.preventDefault();
            initialFocus.current.focus();
          }
        }}
        onCloseAutoFocus={(e) => {
          e.preventDefault();
          (returnFocusTo?.current ?? opener.current)?.focus();
          opener.current = null;
        }}
      >
        <div className="sheet-head" {...grab}>
          <span className="sheet-grip" aria-hidden="true" />
          <DialogTitle className="sheet-title">
            {title}
            {count != null ? (
              <>
                {" "}
                <span className="num">{count}</span>
              </>
            ) : null}
          </DialogTitle>
          <DialogClose className="sheet-close" aria-label={closeLabel}>
            <Icon name="close" />
          </DialogClose>
        </div>
        <div className="sheet-body">{children}</div>
        {footer ? <div className="sheet-foot">{footer}</div> : null}
      </DialogContent>
    </Dialog>
  );
}
