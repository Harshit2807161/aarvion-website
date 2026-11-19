# Fonts

The storefront loads only the committed subsets in `src/fonts/*.woff2`, through `next/font/local`. Nothing is fetched from Google Fonts at runtime.

## Sources and licences

- Host Grotesk: the variable TTF is vendored at `assets/fonts/src/HostGrotesk[wght].ttf`. `SOURCES.json` pins its URL at a fixed google/fonts commit, plus the sha256. Licence: `OFL-HostGrotesk.txt`.
- Geist and Geist Mono: read from `node_modules/geist` (the package's exports map hides its files, so the script uses the path directly). One licence covers both: `OFL-Geist.txt`, the text shipped with the `geist` package, unchanged.
- `assets/fonts/*.txt` is excluded from the PR size count.

## Regenerating

`pnpm fonts:subset` runs `scripts/subset-fonts.ts`. Each job keeps ASCII, Latin-1, the typographic punctuation and the rupee sign (`CORE_RANGES`), pins the weight axis, keeps name IDs 13 and 14 (licence text and URL), and writes woff2.

`scripts/subset-fonts.test.ts` fails if:
- a committed file differs from a fresh subset (drift), so rerun `pnpm fonts:subset` and commit the output;
- a face lacks a required glyph or the licence name IDs;
- a file is over 48,000 bytes (the per-file limit);
- the weight ranges in `src/fonts/index.ts` differ from the baked axes.

The logo is outlined SVG under `public/brand`; there is no wordmark font.
