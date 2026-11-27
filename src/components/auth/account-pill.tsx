"use client";

/**
 * The header's account control (prototype `.sh-acct`, styles in src/styles/header.css), passed to
 * `StoreHeader`'s `account` slot by `withStoreChrome`. It renders signed out first (a real link to
 * /login, so it works without JS and for a modified click), asks `fetchSession()` once the page
 * is idle, and then shows either "Sign in" or the account with the shopper's initial; the 7.5rem
 * width is the same either way, so the header never shifts.
 *
 * A plain click on "Sign in" opens the sign-in dialog instead of leaving the page. The dialog and
 * the whole login flow load on first open (`loadLoginDialog`), never with the page. Any code can
 * ask for it with `openLogin(next)` (checkout uses that): the request travels as a window event,
 * so callers need no context or import of this component. Mount one pill per page: each pill
 * answers the event with its own dialog.
 */
import Link from "next/link";
import {
  type ComponentType,
  type MouseEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { Icon } from "@/components/base/icon";
import { ROUTES } from "@/config/routes";
import { fetchSession } from "./api";
import { loadLoginDialog } from "./load-login-dialog";
import type { LoginDialogProps } from "./login-dialog";

export const LOGIN_EVENT = "aarv:login";
type LoginRequest = { next?: string; returnFocusId?: string };

/**
 * Opens the header sign-in dialog; once signed in it goes to `next` (sanitised), if given. Focus
 * returns on close to the element with id `returnFocusId` if given (a form's Send, so the shopper
 * lands where they were), else to the pill.
 */
export function openLogin(next?: string, opts: { returnFocusId?: string } = {}): void {
  window.dispatchEvent(
    new CustomEvent<LoginRequest>(LOGIN_EVENT, {
      detail: { next, returnFocusId: opts.returnFocusId },
    }),
  );
}

/** Runs `fn` when the browser is idle (after the page's own work), or soon where that is missing. */
function whenIdle(fn: () => void): () => void {
  if (typeof window.requestIdleCallback === "function") {
    const id = window.requestIdleCallback(fn, { timeout: 2000 });
    return () => window.cancelIdleCallback(id);
  }
  const id = setTimeout(fn, 1);
  return () => clearTimeout(id);
}

/** The first grapheme of the name, so an accented or astral first letter is never split. */
function initialOf(name: string | null): string | null {
  const text = name?.trim();
  if (!text) return null;
  const first =
    typeof Intl.Segmenter === "function"
      ? new Intl.Segmenter("en-IN", { granularity: "grapheme" })
          .segment(text)
          [Symbol.iterator]()
          .next().value?.segment
      : Array.from(text)[0];
  return first ? first.toLocaleUpperCase("en-IN") : null;
}

export function AccountPill() {
  // undefined: not asked yet; null: signed out.
  const [user, setUser] = useState<{ name: string | null } | null | undefined>(undefined);
  const [dialog, setDialog] = useState<{ Dialog: ComponentType<LoginDialogProps> } | null>(null);
  const [open, setOpen] = useState(false);
  const [next, setNext] = useState<string | undefined>(undefined);
  const ref = useRef<HTMLAnchorElement>(null);
  const returnId = useRef<string | undefined>(undefined);
  // Read when the dialog closes, so the target is looked up then; the pill when none was asked.
  const [returnTo] = useState(() => ({
    get current(): HTMLElement | null {
      const id = returnId.current;
      return (id ? document.getElementById(id) : null) ?? ref.current;
    },
  }));
  const loading = useRef<Promise<ComponentType<LoginDialogProps>> | null>(null);

  const refresh = useCallback(() => {
    void fetchSession().then(setUser);
  }, []);
  useEffect(() => whenIdle(refresh), [refresh]);

  const show = useCallback(async (nextPath?: string, returnFocusId?: string) => {
    loading.current ??= loadLoginDialog();
    const Dialog = await loading.current;
    setDialog({ Dialog });
    setNext(nextPath);
    returnId.current = returnFocusId;
    setOpen(true);
  }, []);

  useEffect(() => {
    const onRequest = (e: Event) => {
      const detail = (e as CustomEvent<LoginRequest>).detail;
      void show(detail?.next, detail?.returnFocusId);
    };
    window.addEventListener(LOGIN_EVENT, onRequest);
    return () => window.removeEventListener(LOGIN_EVENT, onRequest);
  }, [show]);

  function onClick(e: MouseEvent<HTMLAnchorElement>) {
    // A modified or non-primary click keeps the link's own meaning (a new tab of /login).
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    // On /login itself the page already is the sign-in; a dialog over it would only duplicate it.
    if (window.location.pathname.startsWith(ROUTES.login)) return;
    e.preventDefault();
    void show();
  }

  const Dialog = dialog?.Dialog;
  return (
    <>
      {user ? (
        <Link
          ref={ref}
          className="sh-btn sh-acct"
          href={ROUTES.account}
          aria-label="Your account"
          data-account-pill=""
          data-signed-in=""
        >
          <span className="acct-dot" aria-hidden="true">
            {initialOf(user.name) ?? <Icon name="user" size={18} />}
          </span>
          <Icon className="acct-icon" name="user" />
          <span className="acct-label">Account</span>
        </Link>
      ) : (
        <Link
          ref={ref}
          className="sh-btn sh-acct"
          href={ROUTES.login}
          aria-label="Sign in"
          data-account-pill=""
          onClick={onClick}
        >
          <Icon className="acct-icon" name="user" />
          <span className="acct-label">Sign in</span>
        </Link>
      )}
      {Dialog ? (
        <Dialog
          open={open}
          onOpenChange={setOpen}
          next={next}
          onSignedIn={refresh}
          returnFocusTo={returnTo}
        />
      ) : null}
    </>
  );
}
