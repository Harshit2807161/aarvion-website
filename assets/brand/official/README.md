# Aarvion logo: masters

The owner's official logo, traced to vectors. These files are the masters; the app serves copies
from `public/brand/` (usage guide there) and `src/app/` (favicon, icons, og-image).

**Source.** `source/aarvion-logo-source.jpg`, the owner's file as received (1179 × 592 JPEG, a phone
screenshot). The black bar and the round Live Text button at the bottom are not part of the logo.

**Method** (`scripts/trace_logo.py`; it traces the image, nothing is redrawn or set in type).
Each flat colour is the mode of its shapes' eroded interiors, so JPEG noise does not decide it. Per
colour, every pixel becomes a coverage of that colour over white; a light blur (σ 1px) and a 4×
bicubic upscale give one clean mask per colour, and its 0.5 contour is traced: straight runs are
fitted and snapped to exact horizontals and verticals (one shared baseline and cap height), corners
the blur rounded off are rebuilt by intersecting the neighbouring edges, the swoosh's thin tips are
rebuilt from coverage sections (blur keeps area), and the curves are cubic Béziers. Counters (A, R,
O) stay holes (even-odd fill).

**Verification.** Each layer was rasterised in Chromium at the source size and compared with the
source mask (coverage ≥ 0.5): IoU swoosh 0.9923, wordmark 0.9934 (0.9935 and 0.9942 at 4×). Every
mismatch is a single-pixel edge; overlays and the diff are in `.impeccable/review/logo/` of the
working copy.

**Colours** (logo only, never UI colours): swoosh mint `#68C7A7`, wordmark navy `#045487`. The
one-colour variants use forest `#1F3D2B` or white.

| File | Use |
| --- | --- |
| `aarvion-logo.svg` | Full colour on white and light grounds (store header, og-image) |
| `aarvion-logo-reversed.svg` | Mint and white on forest `#1F3D2B` / forest-900 (footer, admin rail) |
| `aarvion-logo-forest.svg`, `aarvion-logo-white.svg` | One colour: print, embossing, grounds where mint and navy fail |
| `aarvion-mark.svg`, `aarvion-mark-white.svg` | The swoosh alone, where the name is already present or there is no room |
| `png/aarvion-logo{,-reversed}-{1024,2048,4096}.png` | Transparent rasters for tools that cannot take SVG |
| `icons/` | favicon.ico (16/32/48, the swoosh's head), icon.svg, apple-touch-icon (180), icon-192, icon-512-maskable, og-image (1200 × 630) |

**Clear space:** x on every side, where x is the wordmark's cap height (31% of the logo's height);
never less than ½x in UI chrome. **Minimum size:** 24px tall (72px wide) on screen, 20mm wide in
print; below that use the mark, and below 32px wide the favicon's head crop.

**Regenerate** (never hand-edit the outputs): `python3 scripts/trace_logo.py` with numpy, Pillow,
scipy and scikit-image installed. It rewrites this folder, `public/brand/` and the four icons in
`src/app/`, and prints each layer's segment count and IoU; copy the three SVGs and `icons/icon.svg`
(as `aarvion-icon.svg`) into `design/prototype/assets/brand/` too.
