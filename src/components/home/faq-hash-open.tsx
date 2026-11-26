"use client";

import { useEffect } from "react";

/**
 * Opens the FAQ `<details>` a hash points at. Browsers scroll to a closed `<details>` without
 * opening it, so the footer's `/#faq-win2age` and `/#faq-returns` would land on a shut answer.
 * Runs on load and on `hashchange`; a hash that is not a `<details>` is ignored. Renders nothing.
 */
export function FaqHashOpen() {
  useEffect(() => {
    function open() {
      const id = decodeURIComponent(window.location.hash.slice(1));
      const el = id ? document.getElementById(id) : null;
      if (el instanceof HTMLDetailsElement) el.open = true;
    }
    open();
    window.addEventListener("hashchange", open);
    return () => window.removeEventListener("hashchange", open);
  }, []);
  return null;
}
