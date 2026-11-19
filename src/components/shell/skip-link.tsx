"use client";

import { usePathname } from "next/navigation";

/** First focusable element on every customer page: jumps past the header to the content. */
export function SkipLink() {
  const home = usePathname() === "/";
  return (
    <a className="skip" href={home ? "#medicines" : "#main"}>
      {home ? "Skip to medicines" : "Skip to content"}
    </a>
  );
}
