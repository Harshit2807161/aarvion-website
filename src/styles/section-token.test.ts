import { readFileSync } from "node:fs";
import path from "node:path";
import tailwindcss from "@tailwindcss/postcss";
import postcss from "postcss";
import { describe, expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "../..");
const globalsPath = path.join(root, "src/app/globals.css");

/**
 * `--spacing-section` sits in a plain :root rule, not `@theme static`. Inside @theme the
 * `--spacing-*` namespace makes Tailwind 4 generate `h-section` (height: 9rem), which beats the
 * `.h-section` heading class (an unrelated name that only happens to match) and made every
 * `h2.h-section` 144px tall. Heading and padding code reads var(--spacing-section) directly.
 */
describe("--spacing-section stays out of the Tailwind theme", () => {
  it("compiles no height (or any other) utility named .h-section", async () => {
    const result = await postcss([tailwindcss()]).process(readFileSync(globalsPath, "utf8"), {
      from: globalsPath,
    });
    const heights: string[] = [];
    result.root.walkRules((rule) => {
      if (rule.selector !== ".h-section") return;
      rule.walkDecls(/^(height|block-size)$/, (d) => {
        heights.push(d.toString());
      });
    });
    expect(heights).toEqual([]);
  }, 60_000);

  it("is still declared on :root so var(--spacing-section) resolves", async () => {
    const result = await postcss([tailwindcss()]).process(readFileSync(globalsPath, "utf8"), {
      from: globalsPath,
    });
    let value: string | undefined;
    result.root.walkDecls("--spacing-section", (d) => {
      value = d.value;
    });
    expect(value).toBe("clamp(5rem, 3.4rem + 6.4vw, 9rem)");
  }, 60_000);
});
