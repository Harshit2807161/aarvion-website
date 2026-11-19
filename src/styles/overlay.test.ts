import { readFileSync } from "node:fs";
import path from "node:path";
import tailwindcss from "@tailwindcss/postcss";
import postcss from "postcss";
import { beforeAll, describe, expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "../..");
const globalsPath = path.join(root, "src/app/globals.css");

describe("overlay styles in the built CSS", () => {
  let css = "";
  beforeAll(async () => {
    const result = await postcss([tailwindcss()]).process(readFileSync(globalsPath, "utf8"), {
      from: globalsPath,
    });
    css = result.css;
  }, 60_000);

  /** The declarations of the first rule whose selector is exactly `selector`. */
  const rule = (selector: string) => {
    const start = css.indexOf(`\n  ${selector} {`);
    if (start < 0) return "";
    // Tailwind indents nested @supports fallbacks, so the rule ends at the next 2-space brace.
    return css.slice(start, css.indexOf("\n  }", start));
  };

  it("[C16] imports overlay.css: the panel and its phone bottom-sheet rules are emitted", () => {
    expect(rule(".sheet-panel")).toContain("position: fixed");
    expect(css).toContain(".sheet--dialog[data-state=\"open\"]");
    expect(css).toContain("@media (max-width: 639px)");
  });

  it("paints the scrim with an Aarvion token, since --color-black does not exist", () => {
    // shadcn's stock bg-black/50 compiles to nothing once the palette is reset.
    expect(rule(".sheet-scrim")).toMatch(/background:\s*color-mix\(in srgb,\s*var\(--color-forest-950\)\s*50%,\s*transparent\)/);
    expect(css).not.toContain("bg-black");
  });

  it("maps the shadcn colour roles onto the :root roles", () => {
    expect(css).toMatch(/--color-background:\s*var\(--background\)/);
    expect(css).toMatch(/--color-ring:\s*var\(--ring\)/);
  });
});
