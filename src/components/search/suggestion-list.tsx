"use client";

import { useEffect, useRef } from "react";
import { PriceInline } from "@/components/base/stamp-price";
import type { SearchResult } from "@/lib/catalogue/search-result";
import { highlight } from "./highlight";

type Props = {
  /** The listbox id; the combobox's `aria-controls` (`useCombobox().listId`). */
  id: string;
  items: readonly SearchResult[];
  /** The query tokens to highlight in each name (`queryTokens(q)`). */
  tokens: readonly string[];
  /** Index of the active option, or -1. */
  active: number;
  onChoose: (item: SearchResult) => void;
  /** Shown instead of the listbox when there are no items. */
  emptyText: string;
  /** Option id for index i (`useCombobox().optionId`), so `aria-activedescendant` can name it. */
  optionId: (i: number) => string;
};

/** Shelf order, as the API sent it: no re-sorting here. */
export function SuggestionList({
  id,
  items,
  tokens,
  active,
  onChoose,
  emptyText,
  optionId,
}: Props) {
  const listRef = useRef<HTMLUListElement>(null);
  // aria-activedescendant does not scroll: bring the active option into view when it changes.
  useEffect(() => {
    if (active < 0) return;
    listRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: "nearest" });
  }, [active]);

  if (items.length === 0) return <p className="sugg-empty">{emptyText}</p>;
  // No aria-live or role=status: the page has one live region and the count goes through announce().
  return (
    <ul ref={listRef} id={id} role="listbox" aria-label="Medicines" className="sugg">
      {items.map((p, i) => (
        <li
          key={p.slug}
          id={optionId(i)}
          role="option"
          aria-selected={i === active}
          className="sugg-opt"
          // Keep focus in the input: a pointerdown on an option must not blur it.
          onPointerDown={(e) => e.preventDefault()}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onChoose(p)}
        >
          {p.image ? (
            <img src={p.image.src} alt="" width={44} height={44} loading="lazy" decoding="async" />
          ) : (
            <span aria-hidden="true" />
          )}
          <span className="sugg-main">
            <span className="sugg-name">
              {highlight(p.name, tokens).map((s, k) =>
                s.mark ? <mark key={k}>{s.text}</mark> : s.text,
              )}
            </span>
            <span className="sugg-meta">
              {p.salt} · {p.pack}
            </span>
          </span>
          <PriceInline mrpPaise={p.mrpPaise} />
        </li>
      ))}
    </ul>
  );
}
