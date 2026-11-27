"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Icon } from "@/components/base/icon";
import { ROUTES } from "@/config/routes";

const SLACK = 2;
const SETTLE_MS = 80;

/**
 * A rail's arrows and "View all" (the v2 prototype's js/site.js "Rails"), rendered into the
 * `[data-rail-controls]` slot of the head in rails.tsx. While the strip is longer than the page
 * the arrows page it by 80% of its width. "View all N" is a link to the category page, always
 * visible, for a rail of one category; pass no `slug` for the shared rail of several, which has
 * no page of its own and shows none. The arrows render hidden until the first measurement, so no
 * JS means no dead buttons. Scrolling is instant under `prefers-reduced-motion: reduce`.
 * (The in-place "open into a sheet" toggle of the prototype is gone: the category page is that.)
 */
export function RailControls({
  railId,
  title,
  count,
  slug,
}: {
  railId: string;
  title: string;
  count: number;
  slug?: string;
}) {
  const [overflow, setOverflow] = useState(false);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);
  const rowId = `row-${railId}`;

  useEffect(() => {
    const row = document.getElementById(rowId);
    if (!row) return;
    const measure = () => {
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

  return (
    <>
      {slug && (
        <Link className="rail-all" href={ROUTES.category(slug)}>
          <span className="rail-all-t">View all {count}</span>
          <span className="sr-only"> {title.toLowerCase()} medicines</span>
          <Icon name="chev" />
        </Link>
      )}
      <div className="rail-arrows" data-off={overflow ? undefined : ""}>
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
