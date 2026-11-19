"use client";

import { useEffect } from "react";

/**
 * Last resort: the root layout itself failed, so this replaces it and brings its own document.
 * No stylesheet or fonts are loaded here, hence inline styles in the brand colours (forest-800
 * ground, sand-200 button). Logs the error name and digest only; shows no detail.
 */
export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error("global error", { name: error.name, digest: error.digest });
  }, [error]);

  return (
    <html lang="en-IN">
      <body
        style={{
          margin: 0,
          background: "#1f3d2b",
          color: "#fff",
          font: "16px/1.5 system-ui, sans-serif",
        }}
      >
        <main
          style={{ maxWidth: 560, margin: "0 auto", padding: "96px 24px", textAlign: "center" }}
        >
          <h1 style={{ margin: "0 0 12px", fontSize: 32, lineHeight: 1.1 }}>
            Something went wrong
          </h1>
          <p style={{ margin: "0 0 28px", color: "#dfebe2" }}>
            This page didn’t load. Try again, or go back to the home page.
          </p>
          <button
            type="button"
            onClick={() => retry()}
            style={{
              minHeight: 48,
              padding: "0 28px",
              border: 0,
              borderRadius: 999,
              background: "#e8dcc4",
              color: "#172f21",
              font: "600 16px system-ui, sans-serif",
              cursor: "pointer",
            }}
          >
            Try again
          </button>{" "}
          {/* A plain anchor on purpose: the root layout failed, so a full page load is the recovery. */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a href="/" style={{ display: "inline-block", padding: "12px 20px", color: "#fff" }}>
            Go to the home page
          </a>
        </main>
      </body>
    </html>
  );
}
