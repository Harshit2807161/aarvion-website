"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/base/icon";
import { announce } from "@/components/feedback/live-region";

const SLACK = 2;
const SETTLE_MS = 80;

/**
 * A rail's arrows and "View all" (the v2 prototype's js/site.js "Rails"), rendered into the
 * `[data-rail-controls]` slot of the head in rails.tsx. While the strip is longer than the page
 * the arrows page it by 80% of its width, and the toggle opens it in place into a wrapping
 * sheet ("Show fewer" closes it); a strip that already shows every pocket offers neither, since
 * its count says it is the whole category. Task 30 turns the toggle into a link to the
 * category page. Task 30 deletes the toggle: `open`, `toggle()`, its `aria-*` props, the
 * announcements and the `.is-open` / `.is-grid` rules; the arrows and the measuring stay, and
 * `overflow` is what the replacing link needs.
 *
 * The row and rail are server-rendered, so this reaches them by `row-<railId>` and flips
 * `is-grid` / `is-open` on them (src/styles/rails.css owns what those classes look like). Both
 * controls render hidden and appear after the first measurement, so no JS means no dead buttons.
 * The only announcement goes through `announce()`; there is no live region here. Scrolling is
 * instant under `prefers-reduced-motion: reduce`.
 */
export function RailControls({
  railId,
  title,
  count,
}: {
  railId: string;
  title: string;
  count: number;
}) {
  const [open, setOpen] = useState(false);
  const [overflow, setOverflow] = useState(false);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);
  const rowId = `row-${railId}`;

  useEffect(() => {
    const row = document.getElementById(rowId);
    if (!row) return;
    const measure = () => {
      // An open sheet never overflows; measuring then would hide the focused toggle on close.
      if (row.classList.contains("is-grid")) return;
      const max = row.scrollWidth - row.clientWidth;
      setOverflow(max > SLACK);
      setAtStart(row.scrollLeft <= SLACK);
      setAtEnd(row.scrollLeft >= max - SLACK);
    };
    measure();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onScroll = () => {
      clearTimeout(timer);
      timer = setTimeout(measure, SETTLE_MS);
    };
    row.addEventListener("scroll", onScroll, { passive: true });
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    observer?.observe(row);
    return () => {
      row.classList.remove("is-grid");
      row.closest(".rail")?.classList.remove("is-open");
      clearTimeout(timer);
      row.removeEventListener("scroll", onScroll);
      observer?.disconnect();
    };
  }, [rowId]);

  function page(dir: -1 | 1) {
    const row = document.getElementById(rowId);
    if (!row) return;
    const smooth =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: no-preference)").matches;
    row.scrollBy({ left: dir * 0.8 * row.clientWidth, behavior: smooth ? "smooth" : "auto" });
  }

  function toggle() {
    const row = document.getElementById(rowId);
    const rail = row?.closest(".rail");
    if (!row || !rail) return;
    const next = !open;
    setOpen(next);
    rail.classList.toggle("is-open", next);
    row.classList.toggle("is-grid", next);
    if (next) row.scrollLeft = 0;
    else if (rail.getBoundingClientRect().top < 0) rail.scrollIntoView({ block: "start" });
    announce(next ? `${title}: all ${count} medicines shown` : `${title}: showing one row`);
  }

  return (
    <>
      <button
        type="button"
        className="rail-all"
        aria-expanded={open}
        aria-controls={rowId}
        hidden={!open && !overflow}
        onClick={toggle}
      >
        <span className="rail-all-t">{open ? "Show fewer" : `View all ${count}`}</span>
        <span className="sr-only"> {title.toLowerCase()} medicines</span>
        <Icon name="chev" />
      </button>
      <div className="rail-arrows" data-off={open || !overflow ? "" : undefined}>
        <button
          type="button"
          className="rail-btn"
          data-rail="-1"
          aria-label={`Scroll ${title} back`}
          aria-disabled={atStart}
          onClick={() => !atStart && page(-1)}
        >
          <Icon name="back" />
        </button>
        <button
          type="button"
          className="rail-btn"
          data-rail="1"
          aria-label={`Scroll ${title} forward`}
          aria-disabled={atEnd}
          onClick={() => !atEnd && page(1)}
        >
          <Icon name="arrow" />
        </button>
      </div>
    </>
  );
}
