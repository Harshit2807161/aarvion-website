import localFont from "next/font/local";

/**
 * The only fonts the storefront loads: the committed subsets in this folder (built by
 * `pnpm fonts:subset`), self-hosted through next/font, never fetched from Google.
 * Each sets a CSS variable that globals.css reads in --font-display, --font-sans and
 * --font-mono. Weight ranges match the variable-axis range baked into each subset.
 */
export const hostGrotesk = localFont({
  src: "./host-grotesk.woff2",
  weight: "600 700",
  variable: "--font-host-grotesk",
  display: "swap",
  preload: true,
});

export const geist = localFont({
  src: "./geist.woff2",
  weight: "400 600",
  variable: "--font-geist",
  display: "swap",
  preload: true,
});

export const geistMono = localFont({
  src: "./geist-mono.woff2",
  weight: "500 600",
  variable: "--font-geist-mono",
  display: "swap",
  preload: true,
});

/** Class list for <html>: puts the three font variables in scope. */
export const fontVariables = [hostGrotesk.variable, geist.variable, geistMono.variable].join(" ");
