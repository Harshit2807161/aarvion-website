import { readFileSync } from "node:fs";
import path from "node:path";
import postcss, { type Rule } from "postcss";
import { describe, expect, it } from "vitest";

const css = readFileSync(path.resolve(import.meta.dirname, "prose.css"), "utf8");
const globals = readFileSync(path.resolve(import.meta.dirname, "../app/globals.css"), "utf8");
const root = postcss.parse(css);

/** The declarations of the top-level rule with exactly this selector. */
function decls(selector: string): Record<string, string> {
  const out: Record<string, string> = {};
  root.walkRules((rule: Rule) => {
    if (rule.selector === selector && rule.parent?.type === "root")
      rule.walkDecls((d) => void (out[d.prop] = d.value));
  });
  return out;
}

describe("prose.css", () => {
  it("[C16] is imported by globals.css inside the components layer", () => {
    expect(globals).toContain('@import "../styles/prose.css" layer(components);');
  });

  it("sets a 62ch reading measure", () => {
    expect(decls(".prose")["max-width"]).toBe("62ch");
  });

  it("sets section titles in Host Grotesk at title size, with 1px hairlines between sections", () => {
    const h2 = decls(".prose h2").font!;
    expect(h2).toContain("var(--text-title)");
    expect(h2).toContain("var(--font-display)");
    expect(decls(".prose section + section")["border-top"]).toBe("1px solid var(--color-rule)");
  });

  it("marks a pending fact as a sand-100 chip in wait-ink", () => {
    expect(decls(".pending").background).toBe("var(--color-sand-100)");
    expect(decls(".pending").color).toBe("var(--color-wait-ink)");
  });
});
