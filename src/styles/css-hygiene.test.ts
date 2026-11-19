import { globSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "../..");

/** Split a selector list on top-level commas (not those inside :is(...) and the like). */
function splitSelectors(prelude: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = "";
  for (const ch of prelude) {
    if (ch === "(" || ch === "[") depth++;
    if (ch === ")" || ch === "]") depth--;
    if (ch === "," && depth === 0) {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out.map((s) => s.replace(/\s+/g, " ").trim()).filter(Boolean);
}

/**
 * Every style rule's selectors, keyed by their at-rule context. `@layer` wrappers are
 * transparent; `@media`/`@supports` add their condition to the context; keyframes and
 * font-face bodies and nested rules are skipped.
 */
function ruleKeys(css: string): string[] {
  const src = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const keys: string[] = [];
  const stack: { kind: "context" | "rule" | "skip"; context: string }[] = [];
  let buf = "";
  let parens = 0;
  const context = () => stack.at(-1)?.context ?? "";
  for (const ch of src) {
    if (ch === "(") parens++;
    if (ch === ")") parens--;
    if (ch === ";" && parens === 0) buf = "";
    else if (ch === "{") {
      const prelude = buf.replace(/\s+/g, " ").trim();
      buf = "";
      const parent = stack.at(-1);
      if (parent && parent.kind !== "context") stack.push({ kind: "skip", context: context() });
      else if (prelude.startsWith("@layer")) stack.push({ kind: "context", context: context() });
      else if (/^@(media|supports|container)/.test(prelude))
        stack.push({ kind: "context", context: `${context()}${prelude} ` });
      else if (prelude.startsWith("@")) stack.push({ kind: "skip", context: context() });
      else {
        for (const sel of splitSelectors(prelude)) keys.push(`${context()}${sel}`);
        stack.push({ kind: "rule", context: context() });
      }
    } else if (ch === "}") {
      stack.pop();
      buf = "";
    } else buf += ch;
  }
  return keys;
}

describe("ruleKeys", () => {
  it("splits lists, ignores @layer and keeps @media apart", () => {
    const css = `@layer base { a, b:is(.x, .y) { color: red } @media (min-width: 1px) { a { color: blue } } }`;
    expect(ruleKeys(css)).toEqual(["a", "b:is(.x, .y)", "@media (min-width: 1px) a"]);
  });

  it("skips keyframes and nested rules", () => {
    const css = `@keyframes k { from { opacity: 0 } } .a { & .b { color: red } }`;
    expect(ruleKeys(css)).toEqual([".a"]);
  });
});

describe("[C12] src/styles hygiene", () => {
  const files = globSync("src/styles/*.css", { cwd: root });

  it("finds the style sources", () => {
    expect(files).toContain("src/styles/base.css");
  });

  it.each(files.map((f) => [f]))("%s repeats no selector within an at-rule context", (file) => {
    const keys = ruleKeys(readFileSync(path.join(root, file), "utf8"));
    const duplicates = keys.filter((k, i) => keys.indexOf(k) !== i);
    expect([...new Set(duplicates)]).toEqual([]);
  });
});
