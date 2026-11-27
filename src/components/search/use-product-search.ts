"use client";

import { useEffect, useRef, useState } from "react";
import { STRENGTH_RE, type SearchResult } from "@/lib/catalogue/search-result";
import { queryTokens } from "@/server/catalogue/search";

/** A fast typist can reach the server's 60 a minute in about 12 s; this keeps them well under. */
export const SEARCH_DEBOUNCE_MS = 150;

export type SearchStatus = "idle" | "loading" | "done" | "limited" | "error";

/** One shared empty list, so a caller passing `results` on as a prop never sees a new array per render. */
const NONE: SearchResult[] = [];

type Settled = { key: string; results: SearchResult[]; status: "done" | "limited" | "error" };

/** The request URL for a query, or null when there is nothing to ask (no tokens and no strength). */
function requestKey(q: string, strength: string | null): string | null {
  // queryTokens caps at 64 characters, so the server's query_too_long cannot happen.
  const normalised = queryTokens(q).join(" ");
  const s = strength !== null && STRENGTH_RE.test(strength) ? strength : null;
  if (normalised === "" && s === null) return null;
  return `/api/products?q=${encodeURIComponent(normalised)}${s === null ? "" : `&strength=${s}`}`;
}

function isResult(v: unknown): v is SearchResult {
  if (typeof v !== "object" || v === null) return false;
  const r = v as Record<string, unknown>;
  return (
    typeof r.slug === "string" &&
    typeof r.name === "string" &&
    typeof r.salt === "string" &&
    typeof r.pack === "string" &&
    typeof r.mrpPaise === "number" &&
    (r.image === null ||
      (typeof r.image === "object" && typeof (r.image as { src?: unknown }).src === "string"))
  );
}

/**
 * Debounced product search over `GET /api/products`. A new query aborts the previous request;
 * a response is applied only if its query is still current. A 429 sets `limited` and is never
 * retried: nothing refetches until the (normalised) query or strength changes. Any other failure,
 * a non-JSON body or an unexpected shape is `error`; nothing here throws or logs, because a
 * medicine search can be health data. Results keep the API's shelf order. Results carry the key
 * they answered: until the current query has settled, the list is empty and the status is
 * `loading`, so nothing (Enter, a click) can pick a medicine that belongs to an earlier query.
 */
export function useProductSearch(
  q: string,
  strength: string | null,
): { results: SearchResult[]; status: SearchStatus } {
  const key = requestKey(q, strength);
  const [settled, setSettled] = useState<Settled | null>(null);
  const seqRef = useRef(0);

  useEffect(() => {
    if (key === null) return;
    const seq = ++seqRef.current;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      let next: Settled;
      try {
        const res = await fetch(key, { signal: controller.signal });
        if (res.status === 429) next = { key, results: [], status: "limited" };
        else if (!res.ok) next = { key, results: [], status: "error" };
        else {
          const body: unknown = await res.json();
          const list = (body as { results?: unknown } | null)?.results;
          next =
            Array.isArray(list) && list.every(isResult)
              ? { key, results: list, status: "done" }
              : { key, results: [], status: "error" };
        }
      } catch {
        if (controller.signal.aborted) return;
        next = { key, results: [], status: "error" };
      }
      // Sequence guard: only the latest request may write, even if an older one already resolved.
      if (seq === seqRef.current && !controller.signal.aborted) setSettled(next);
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [key]);

  if (key === null) return { results: NONE, status: "idle" };
  if (settled?.key === key) return { results: settled.results, status: settled.status };
  return { results: NONE, status: "loading" };
}
