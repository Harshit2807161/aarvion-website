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

/**
 * The header's sign-in dialog (pages/login.html's `#login-dialog`): the login flow in an
 * `Overlay` (a centred dialog, a bottom sheet below 640px), loaded on first open by
 * `loadLoginDialog`. Its accessible name is "Sign in"; the visible heading is the flow's own.
 * Once signed in, "You’re signed in" shows for `DONE_MS`; then, with `next`, the dialog goes there
 * (`sanitizeNext`, undecoded); without, it closes and toasts "Signed in as <first name>".
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
  useEffect(() => () => clearTimeout(timer.current), []);

  function done(r: LoginDone) {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      if (next !== undefined) {
        router.push(sanitizeNext(next));
        return;
      }
      onOpenChange(false);
      toast(LOGIN_COPY.signedInToast(r.name?.trim().split(/\s+/)[0] || null));
      onSignedIn?.();
    }, DONE_MS);
  }

  return (
    <Overlay
      open={open}
      onOpenChange={(o) => {
        if (!o) clearTimeout(timer.current);
        onOpenChange(o);
      }}
      variant="dialog"
      title={<span className="sr-only">Sign in</span>}
      closeLabel="Close sign in"
      returnFocusTo={returnFocusTo}
    >
      <LoginFlow mode="dialog" next={next} onDone={done} />
    </Overlay>
  );
}
