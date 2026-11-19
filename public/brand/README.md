# public/brand: the Aarvion logo for the app

Served from `/brand/…`. These are copies of the masters in `assets/brand/official/` (source,
method, verification). Use the files as they are.

## Which file where

| Ground or slot | File |
| --- | --- |
| White or light ground (store header: 40px tall, 34px on phones) | `aarvion-logo.svg` |
| Forest ground, forest-800 `#1F3D2B` or forest-900 (store footer, admin rail) | `aarvion-logo-reversed.svg` |
| One colour on light / on dark (print, embossing, photos) | `aarvion-logo-forest.svg` / `aarvion-logo-white.svg` |
| The swoosh alone (collapsed rail, closing act, dialog heads, signed-out screen) | `aarvion-mark.svg`, or `aarvion-mark-white.svg` on dark |
| A tool that cannot take SVG | `png/aarvion-logo{,-reversed}-{1024,2048,4096}.png` (transparent) |
| Web app manifest icons | `icon-192.png`, `icon-512-maskable.png` (`"purpose": "maskable"`) |

The favicon, `icon.svg`, apple icon and og-image live in `src/app/` as Next.js file-convention
icons, so the metadata picks them up without any code.

## Rules

- Never redraw, recolour, retype, re-space, stretch, outline or add effects to the logo, and never
  rebuild it from a font. If a variant is missing, regenerate it; do not edit the SVG by hand.
- Mint `#68C7A7` and navy `#045487` are logo colours only. Never use them for UI fills, text or
  icons; the UI's greens are forest and leaf (DESIGN.md).
- Size by height with `width: auto` (the SVGs carry their aspect ratio). Keep the wordmark's cap
  height clear around the logo (at least half of it in UI chrome); the full logo is never under
  24px tall, use the mark below that.
- Inside a link that already has an accessible name, give the image `alt=""`; standing alone, use
  `alt="Aarvion"`.

## Regenerate

`python3 scripts/trace_logo.py` (needs numpy, Pillow, scipy, scikit-image) re-traces the owner's
source and rewrites `assets/brand/official/`, this folder and the icons in `src/app/`.
`scripts/brand-assets.test.ts` checks every SVG here: it parses, has a viewBox, embeds no image and
uses only the logo colours.
