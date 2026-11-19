"use client";

import Link from "next/link";
import type { ComponentProps, MouseEvent } from "react";

/**
 * The "Search for a medicine" card: a link to the header search field (`#q`, store-header.tsx).
 * Without JS the `#q` hash is the fallback; with it the click puts the caret in the field
 * (the prototype's store.js `[data-search]` handler). The only client island in the quick
 * actions, so the section itself stays a server component.
 */
export function SearchCardLink({ onClick, ...props }: ComponentProps<typeof Link>) {
  function focusSearch(e: MouseEvent<HTMLAnchorElement>) {
    onClick?.(e);
    const input = document.getElementById("q");
    if (e.defaultPrevented || !input) return;
    e.preventDefault();
    input.focus();
  }
  return <Link {...props} data-search="" onClick={focusSearch} />;
}
