"use client";

import { useRouter } from "next/navigation";
import {
  useEffect,
  useRef,
  useState,
  type FocusEvent,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { Icon } from "@/components/base/icon";
import { announce } from "@/components/feedback/live-region";
import { ROUTES } from "@/config/routes";
import { plural } from "@/lib/catalogue/display";
import { STRENGTH_RE, type SearchResult } from "@/lib/catalogue/search-result";
import { queryTokens } from "@/server/catalogue/search";
import { SuggestionList } from "./suggestion-list";
import { useCombobox } from "./use-combobox";
import { useProductSearch } from "./use-product-search";

const EMPTY_TEXT = "No medicine matches. Try a brand such as Sacuwin or a salt such as Valsartan.";
const LIMITED_TEXT = "Too many searches. Try again in a moment.";
const ERROR_TEXT = "Search is not available right now. Try again in a moment.";

/**
 * Brings a shelf pocket into view and puts focus on its cart control (the Add button, or the
 * stepper's + once it is in the cart). `is-found` marks it, and is cleared from any other.
 */
function reveal(el: HTMLElement) {
  document.querySelectorAll(".is-found").forEach((x) => x.classList.remove("is-found"));
  el.scrollIntoView({ block: "center", inline: "center" });
  el.classList.add("is-found");
  const ctl = el.querySelector<HTMLElement>(".cart-ctl");
  const target =
    ctl?.dataset.qty === "0" || !ctl?.querySelector("[data-inc]") ? "[data-add]" : "[data-inc]";
  ctl?.querySelector<HTMLElement>(target)?.focus({ preventScroll: true });
}

/**
 * The header search: brand or salt, optionally narrowed by a strength chip. The parts live beside
 * it (`useProductSearch` debounces and talks to `/api/products`, `useCombobox` carries the ARIA 1.2
 * keys, `SuggestionList` draws the options). Without JavaScript it is a plain GET form to the
 * medicines section. Result counts are spoken through `announce()` only; nothing here logs the
 * query. Choosing a result reveals its pocket on the home page, and goes to its product page
 * anywhere else.
 */
export function HeaderSearch({ chips }: { chips: string[] }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState("");
  const [strength, setStrength] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  // Enter pressed while the current query is still loading: open its first result once it settles.
  const submitPending = useRef(false);

  const strengths = chips.filter((c) => STRENGTH_RE.test(c));
  const hasQuery = queryTokens(q).length > 0 || strength !== null;
  const { results, status } = useProductSearch(q, strength);
  const items = hasQuery ? results : [];

  function choose(item: SearchResult) {
    setOpen(false);
    // Read at the click, not through usePathname(): that hook would need a Suspense boundary in the
    // chrome of every page rendered at request time, and a boundary delays this input's hydration.
    const el = window.location.pathname === "/" ? document.getElementById(`p-${item.slug}`) : null;
    if (el) reveal(el);
    else router.push(ROUTES.product(item.slug));
  }

  const combo = useCombobox<SearchResult>({
    items,
    open,
    idPrefix: "sugg",
    onChoose: choose,
    onClose: () => setOpen(false),
    onClear: () => setQ(""),
  });

  // The page's one polite live region speaks the outcome; the listbox itself never does.
  useEffect(() => {
    if (!hasQuery) return;
    if (status === "done") {
      announce(
        results.length > 0 ? `${plural(results.length, "medicine")} found` : "No medicine matches",
      );
    } else if (status === "limited") announce(LIMITED_TEXT);
  }, [status, results, hasQuery]);

  // A remembered Enter fires only for the query it was pressed on: typing again drops it.
  useEffect(() => {
    if (!submitPending.current || status === "loading" || status === "idle") return;
    submitPending.current = false;
    // Not synchronously: choosing closes the panel (a state update), which an effect must not do.
    const first = status === "done" ? results[0] : undefined;
    if (first) queueMicrotask(() => choose(first));
  });

  // "Search for a medicine" anywhere on the page puts the caret in the header search.
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!(e.target instanceof Element) || !e.target.closest("[data-search]")) return;
      e.preventDefault();
      inputRef.current?.focus();
    }
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    // The first Escape only closes the list and the second only clears the field; neither also
    // bubbles to an ancestor handler. With nothing left to do the key is free to propagate. This
    // does not protect a Radix dialog, which listens in the capture phase: one would need its own guard.
    if (e.key === "Escape" && !e.nativeEvent.isComposing && (open || q !== "")) e.stopPropagation();
    if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      e.preventDefault();
      setOpen(true);
      return;
    }
    combo.inputProps.onKeyDown(e);
  }

  // Escape on a chip (or anywhere else in the panel) closes it and returns focus to the field.
  function onFormKeyDown(e: KeyboardEvent<HTMLFormElement>) {
    if (e.key !== "Escape" || e.target === inputRef.current || !open) return;
    e.stopPropagation();
    inputRef.current?.focus(); // reopens through onFocus, so close after
    setOpen(false);
  }

  // With JavaScript running the form never submits natively (that would drop what was typed and
  // put the query in server logs). Enter opens the first result of the query shown; while that
  // query is still loading it is remembered and runs when the query settles; with no match, a
  // limit or an error the panel's message stays on screen. Without JavaScript the plain GET form
  // to the medicines section is the fallback.
  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (items.length > 0) choose(items[0]!);
    else if (hasQuery && status === "loading") submitPending.current = true;
  }

  function onFocusOut(e: FocusEvent<HTMLFormElement>) {
    if (!formRef.current?.contains(e.relatedTarget as Node | null)) setOpen(false);
  }

  let body: React.ReactNode;
  let listShown = false;
  if (!hasQuery) {
    body = (
      <p className="sugg-hint" id="sugg-hint">
        Type a brand such as Sacuwin or a salt such as Valsartan.
      </p>
    );
  } else if (status === "limited") body = <p className="sugg-empty">{LIMITED_TEXT}</p>;
  else if (status === "error") body = <p className="sugg-empty">{ERROR_TEXT}</p>;
  else if (status === "loading" && items.length === 0) body = null;
  else {
    listShown = items.length > 0;
    body = (
      <SuggestionList
        id="sugg"
        items={items}
        tokens={queryTokens(q)}
        active={combo.active}
        onChoose={choose}
        emptyText={EMPTY_TEXT}
        optionId={combo.optionId}
      />
    );
  }

  return (
    <form
      ref={formRef}
      className="search"
      role="search"
      action={ROUTES.medicines}
      autoComplete="off"
      onSubmit={onSubmit}
      onBlur={onFocusOut}
      onKeyDown={onFormKeyDown}
    >
      <label className="sr-only" htmlFor="q">
        Search medicines by brand or salt
      </label>
      <div className="search-pill">
        <Icon name="search" />
        <input
          ref={inputRef}
          id="q"
          name="q"
          type="search"
          spellCheck={false}
          placeholder="Search medicines by brand or salt"
          value={q}
          onChange={(e) => {
            submitPending.current = false;
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          {...combo.inputProps}
          onKeyDown={onKeyDown}
          aria-controls={listShown ? "sugg" : undefined}
          aria-describedby={hasQuery ? undefined : "sugg-hint"}
        />
      </div>
      <div className="sugg-panel" hidden={!open}>
        {strengths.length > 0 && (
          // Safari and Firefox on macOS do not focus a button on mousedown, so without this the input
          // blurs, the panel closes and the click never lands (same guard as SuggestionList).
          <div
            className="chips"
            onPointerDown={(e) => e.preventDefault()}
            onMouseDown={(e) => e.preventDefault()}
          >
            <span className="chips-label" id="chips-label">
              Strength
            </span>
            {strengths.map((c) => (
              <button
                key={c}
                type="button"
                className="sugg-chip"
                aria-pressed={strength === c}
                onClick={() => setStrength(strength === c ? null : c)}
              >
                {c}
              </button>
            ))}
          </div>
        )}
        {body}
      </div>
    </form>
  );
}
