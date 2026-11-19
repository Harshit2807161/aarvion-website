import { readFileSync } from "node:fs";
import path from "node:path";
import * as fontkit from "fontkit";
import { describe, expect, it } from "vitest";
import { CORE_RANGES, FONT_JOBS, subsetFont } from "./subset-fonts.ts";

const root = path.resolve(import.meta.dirname, "..");
const committed = (out: string) => readFileSync(path.join(root, "src/fonts", out));
const open = (out: string) => {
  const font = fontkit.openSync(path.join(root, "src/fonts", out));
  if (!("variationAxes" in font)) throw new Error(`${out}: not a single font`);
  return font;
};

const ascii = Array.from({ length: 0x7f - 0x20 }, (_, i) => String.fromCodePoint(0x20 + i)).join("");
const extras = "₹’“”–—·×→…•−";

describe("subset fonts", () => {
  it("keeps the next/font weight ranges in src/fonts/index.ts equal to the baked axes", () => {
    const source = readFileSync(path.join(root, "src/fonts/index.ts"), "utf8");
    const weights = [...source.matchAll(/weight: "(\d+) (\d+)"/g)].map((m) => [Number(m[1]), Number(m[2])]);
    const baked = FONT_JOBS.map((j) => {
      const wght = j.axes.wght as { min: number; max: number };
      return [wght.min, wght.max];
    });
    expect(weights).toEqual(baked);
  });

  it("covers the core ranges the storefront needs", () => {
    expect(CORE_RANGES).toContainEqual([0x20b9, 0x20b9]);
    expect(FONT_JOBS.map((j) => j.out)).toEqual([
      "host-grotesk.woff2",
      "geist.woff2",
      "geist-mono.woff2",
    ]);
  });

  describe.each(FONT_JOBS.map((job) => [job.out, job] as const))("%s", (out, job) => {
    const font = open(out);

    it("has ASCII and the typographic and rupee glyphs", () => {
      for (const ch of ascii + extras) {
        const cp = ch.codePointAt(0)!;
        expect(font.hasGlyphForCodePoint(cp), `U+${cp.toString(16)}`).toBe(true);
      }
    });

    it("keeps the licence name IDs 13 and 14", () => {
      const names = (font as unknown as { name: { records: Record<string, unknown> } }).name.records;
      expect(names.license, "name id 13").toBeTruthy();
      expect(names.licenseURL, "name id 14").toBeTruthy();
    });

    it("stays within the size budget", () => {
      expect(committed(out).length).toBeLessThanOrEqual(48_000);
    });

    it("matches a fresh subset byte for byte (drift)", async () => {
      expect(Buffer.compare(await subsetFont(job), committed(out))).toBe(0);
    });
  });

  it("limits Host Grotesk to wght 600-700", () => {
    expect(open("host-grotesk.woff2").variationAxes.wght).toMatchObject({ min: 600, max: 700 });
  });
});
