"use client";

import { useRouter } from "next/navigation";
import { type RefObject, useEffect, useRef } from "react";
import { toast } from "@/components/feedback/toast";
import { Overlay } from "@/components/overlay/overlay";
import { sanitizeNext } from "@/lib/next-url";
import { DONE_MS, type LoginDone, LoginFlow } from "./login-flow";
import { LOGIN_COPY } from "./login-machine";

export type LoginDialogProps = {
  open: boolean;
  onOpenChange(open: boolean): void;
  /** Where to go once signed in (checkout, an account page); unset keeps the shopper here. */
  next?: string;
  /** Called after a sign-in that stays on the page, so the header can show the account. */
  onSignedIn?(): void;
  returnFocusTo?: RefObject<HTMLElement | null>;
};

/** The flow's identifier field: the dialog opens on it, as the prototype does (`#dlg-mobile`). */
function identifierField(): HTMLElement | null {
  return document.getElementById("dlg-mobile") ?? document.getElementById("dlg-email");
}

/**
 * The header's sign-in dialog (pages/login.html's `#login-dialog`): the login flow in an
 * `Overlay` (a centred dialog, a bottom sheet below 640px), loaded on first open by
 * `loadLoginDialog`. Its accessible name is "Sign in"; the visible heading is the flow's own. It
 * opens on the identifier field, and focus returns to `returnFocusTo` (the header pill) on close.
 *
 * Once signed in, "You’re signed in" shows for `DONE_MS`; then the dialog closes and the header
 * is told (`onSignedIn`) before anything else, because the header lives in the persistent layout:
 * with `next` it then goes there (`sanitizeNext`, undecoded), without it toasts "Signed in as
 * <first name>". Closing the dialog during the done step skips the redirect and the toast, but the
 * shopper is signed in, so the header is still told, exactly once.
 */
export function LoginDialog({
  open,
  onOpenChange,
  next,
  onSignedIn,
  returnFocusTo,
}: LoginDialogProps) {
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  // Set once signed in; cleared after the header has been told.
  const signedIn = useRef(false);
  useEffect(() => () => clearTimeout(timer.current), []);

  function tellHeader() {
    if (!signedIn.current) return;
    signedIn.current = false;
    onSignedIn?.();
  }

  function done(r: LoginDone) {
    signedIn.current = true;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      onOpenChange(false);
      tellHeader();
      if (next !== undefined) {
        router.push(sanitizeNext(next));
        return;
      }
      toast(LOGIN_COPY.signedInToast(r.name?.trim().split(/\s+/)[0] || null));
    }, DONE_MS);
  }

  return (
    <Overlay
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          clearTimeout(timer.current);
          tellHeader();
        }
        onOpenChange(o);
      }}
      variant="dialog"
      title={<span className="sr-only">Sign in</span>}
      closeLabel="Close sign in"
      initialFocus={identifierField}
      returnFocusTo={returnFocusTo}
    >
      <LoginFlow mode="dialog" next={next} onDone={done} />
    </Overlay>
  );
}
