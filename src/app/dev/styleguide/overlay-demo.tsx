"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/base/button";
import { Overlay } from "@/components/overlay/overlay";

type Variant = "dialog" | "side";

/**
 * Styleguide demo of the dialog and side sheet. `?overlay=dialog|side` opens one on load so a
 * screenshot can capture it. The query is read in an effect on the client, never through the
 * page's `searchParams`, because Cache Components prerenders the page [C17].
 */
export function OverlayDemo() {
  const [open, setOpen] = useState<Variant | null>(null);
  const email = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const wanted = new URLSearchParams(window.location.search).get("overlay");
    // Reading the URL is the external system this effect syncs from, once after hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (wanted === "dialog" || wanted === "side") setOpen(wanted);
  }, []);

  return (
    <>
      <div className="flex flex-wrap gap-3">
        <Button variant="forest" onClick={() => setOpen("dialog")}>
          Open dialog
        </Button>
        <Button variant="quiet" onClick={() => setOpen("side")}>
          Open side sheet
        </Button>
      </div>
      {(["dialog", "side"] as const).map((variant) => (
        <Overlay
          key={variant}
          open={open === variant}
          onOpenChange={(next) => setOpen(next ? variant : null)}
          variant={variant}
          title={variant === "dialog" ? "Sign in" : "Your cart"}
          count={variant === "side" ? "2 items" : undefined}
          closeLabel={variant === "dialog" ? "Close sign in" : "Close cart"}
          initialFocus={variant === "dialog" ? email : undefined}
          footer={
            variant === "side" ? (
              <Button variant="forest" block onClick={() => setOpen(null)}>
                Continue
              </Button>
            ) : undefined
          }
        >
          {variant === "dialog" ? (
            <label className="grid gap-2 py-4 text-sm font-semibold">
              Email or mobile number
              <input
                ref={email}
                className="min-h-12 rounded-xs border border-line-strong px-3 text-base font-normal"
                type="text"
              />
            </label>
          ) : (
            <p className="py-4">Example content. The body scrolls; the head and foot stay put.</p>
          )}
        </Overlay>
      ))}
    </>
  );
}
