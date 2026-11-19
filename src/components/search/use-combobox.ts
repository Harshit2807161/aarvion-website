"use client";

import { useState, type KeyboardEvent } from "react";

type Options<T> = {
  items: readonly T[];
  /** Whether the popup is showing. Closed: the arrows and Enter do nothing, Escape clears. */
  open: boolean;
  /** Prefix for the ids of the list and its options; keep it unique on the page. */
  idPrefix: string;
  onChoose: (item: T) => void;
  onClose: () => void;
  onClear: () => void;
};

/**
 * Keyboard and ARIA wiring for the WAI-ARIA 1.2 combobox with a list popup. DOM focus stays on
 * the input; the highlighted option is named by `aria-activedescendant`. Spread `inputProps` on
 * the input, give the listbox `id={listId}` and each option `id={optionId(i)}` with
 * `aria-selected={i === active}`. Arrows wrap; Enter chooses the active item, or the first when
 * none is active; Escape closes the popup, and once it is closed clears the field. The active
 * option resets whenever `items` or `open` changes. This hook adds no live region: the result
 * count is spoken through `announce()`.
 */
export function useCombobox<T>({ items, open, idPrefix, onChoose, onClose, onClear }: Options<T>) {
  // Reset during render when the list or its visibility changes (no effect, no stale highlight).
  const [state, setState] = useState<{ items: readonly T[]; open: boolean; active: number }>({
    items,
    open,
    active: -1,
  });
  let active = state.active;
  if (state.items !== items || state.open !== open) {
    active = -1;
    setState({ items, open, active });
  }

  const listId = `${idPrefix}-list`;
  const optionId = (i: number) => `${idPrefix}-opt-${i}`;
  const live = open && items.length > 0;

  function onKeyDown(e: KeyboardEvent<HTMLElement>) {
    switch (e.key) {
      case "ArrowDown":
      case "ArrowUp": {
        if (!live) return;
        e.preventDefault();
        const n = items.length;
        const next =
          e.key === "ArrowDown" ? (active + 1) % n : active < 0 ? n - 1 : (active + n - 1) % n;
        setState({ items, open, active: next });
        return;
      }
      case "Enter": {
        if (!live) return;
        e.preventDefault();
        onChoose(items[active >= 0 ? active : 0]!);
        return;
      }
      case "Escape": {
        if (open) onClose();
        else onClear();
        return;
      }
    }
  }

  return {
    active,
    listId,
    optionId,
    inputProps: {
      role: "combobox" as const,
      "aria-autocomplete": "list" as const,
      "aria-expanded": open,
      "aria-controls": listId,
      "aria-activedescendant": live && active >= 0 ? optionId(active) : undefined,
      onKeyDown,
    },
  };
}
