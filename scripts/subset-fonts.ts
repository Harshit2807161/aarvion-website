/**
 * Build the self-hosted storefront fonts: `pnpm fonts:subset`.
 *
 * Each job subsets one variable font to the Latin + rupee set the site uses, pins the
 * weight axes to what the design needs and writes woff2 into src/fonts/. The output is
 * committed; scripts/subset-fonts.test.ts fails if it drifts from this script.
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import subset from "subset-font";

/** Inclusive code-point ranges: Basic Latin, Latin-1, the punctuation we set, ₹ → − */
export const CORE_RANGES: ReadonlyArray<readonly [number, number]> = [
  [0x20, 0x7e],
  [0xa0, 0xff],
  [0x2013, 0x2014],
  [0x2018, 0x2019],
  [0x201c, 0x201d],
  [0x2022, 0x2022],
  [0x2026, 0x2026],
  [0x20b9, 0x20b9],
  [0x2192, 0x2192],
  [0x2212, 0x2212],
];

export type FontJob = {
  /** File name inside src/fonts/. */
  out: string;
  /** Source font: a path under the repo root, or a module path resolved from node_modules. */
  from: string;
  axes: Record<string, number | { min: number; max: number }>;
};

export const FONT_JOBS: FontJob[] = [
  {
    out: "host-grotesk.woff2",
    from: "assets/fonts/src/HostGrotesk[wght].ttf",
    axes: { wght: { min: 600, max: 700 } },
  },
  {
    out: "geist.woff2",
    from: "geist/dist/fonts/geist-sans/Geist-Variable.woff2",
    axes: { wght: { min: 400, max: 600 } },
  },
  {
    out: "geist-mono.woff2",
    from: "geist/dist/fonts/geist-mono/GeistMono-Variable.woff2",
    axes: { wght: { min: 500, max: 600 } },
  },
];

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const CORE_TEXT = CORE_RANGES.flatMap(([lo, hi]) =>
  Array.from({ length: hi - lo + 1 }, (_, i) => String.fromCodePoint(lo + i)),
).join("");

/** Paths are repo-relative, or `<package>/...` under node_modules (geist's exports map hides its files). */
const sourcePath = (from: string) =>
  from.startsWith("assets/") ? path.join(root, from) : path.join(root, "node_modules", from);

/** Subset one font to woff2. Name IDs 13 and 14 (licence text and URL) are kept for the OFL. */
export async function subsetFont(job: FontJob): Promise<Buffer> {
  return subset(readFileSync(sourcePath(job.from)), CORE_TEXT, {
    targetFormat: "woff2",
    preserveNameIds: [13, 14],
    variationAxes: job.axes,
  });
}

async function main(): Promise<void> {
  for (const job of FONT_JOBS) {
    const bytes = await subsetFont(job);
    writeFileSync(path.join(root, "src/fonts", job.out), bytes);
    console.log(`wrote src/fonts/${job.out} (${bytes.length} bytes)`);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  void main();
}
