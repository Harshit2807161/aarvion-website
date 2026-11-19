"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";

export const ANNOUNCEMENTS = [
  "Free delivery across India",
  "Cash on delivery available",
  "A pharmacist checks every prescription",
] as const;

/** How long each notice stays up when they cross-fade on a phone. */
export const ANNOUNCE_MS = 5000;

const PHONE = "(max-width: 720px)";
const REDUCED = "(prefers-reduced-motion: reduce)";

/**
 * The line above the header. Desktop shows all three notices; at 720px and below it cross-fades
 * one at a time every 5 s (header.css does the fade; this component only moves `is-on`). Under
 * reduced motion a phone shows the first notice only. Server markup is the first notice alone
 * on phones (CSS), so there is no flash before the effect runs.
 */
export function AnnounceBar() {
  const [rotating, setRotating] = useState(false);
  const [on, setOn] = useState(0);

  useEffect(() => {
    const phone = window.matchMedia(PHONE);
    const reduced = window.matchMedia(REDUCED);
    let timer: ReturnType<typeof setInterval> | undefined;
    const run = () => {
      clearInterval(timer);
      setOn(0);
      const rotate = phone.matches && !reduced.matches;
      setRotating(rotate);
      if (!rotate) return;
      timer = setInterval(() => {
        if (document.hidden) return;
        setOn((i) => (i + 1) % ANNOUNCEMENTS.length);
      }, ANNOUNCE_MS);
    };
    phone.addEventListener("change", run);
    reduced.addEventListener("change", run);
    run();
    return () => {
      clearInterval(timer);
      phone.removeEventListener("change", run);
      reduced.removeEventListener("change", run);
    };
  }, []);

  return (
    <div className={cn("announce", rotating && "is-rotating")} data-announce>
      <p className="wrap announce-in">
        {ANNOUNCEMENTS.map((text, i) => (
          <span key={text} className={cn("ann", rotating && i === on && "is-on")}>
            {text}
          </span>
        ))}
      </p>
    </div>
  );
}
