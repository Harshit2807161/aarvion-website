import { globSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "../..");
const read = (p: string) => readFileSync(path.join(root, p), "utf8");
const collapse = (s: string) => s.replace(/\s+/g, " ").trim();
const stripComments = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "");

const globals = collapse(stripComments(read("src/app/globals.css")));

/** Every `--name: value;` declaration inside tokens.css's :root, comments removed. */
function tokenDeclarations(): string[] {
  const css = stripComments(read("design/prototype/css/tokens.css"));
  const body = css.slice(css.indexOf("{") + 1, css.lastIndexOf("}"));
  return body
    .split(";")
    .map(collapse)
    .filter((d) => d.startsWith("--"))
    .map((d) => `${d};`);
}

/** The `colors:` map of the DESIGN.md frontmatter. */
function designColors(): Record<string, string> {
  const front = read("DESIGN.md").split("---")[1] ?? "";
  const block = front.slice(front.indexOf("colors:"), front.indexOf("typography:"));
  const out: Record<string, string> = {};
  for (const m of block.matchAll(/^\s+([\w-]+):\s*"(#[0-9a-fA-F]{6})"/gm)) {
    out[m[1]!] = m[2]!;
  }
  return out;
}

describe("design tokens in globals.css", () => {
  const declarations = tokenDeclarations().filter((d) => !d.startsWith("--font-"));

  it("reads the prototype tokens", () => {
    expect(declarations.length).toBeGreaterThan(100);
  });

  it.each(declarations.map((d) => [d]))("carries %s verbatim", (declaration) => {
    expect(globals).toContain(declaration);
  });

  it("leaves --font-* to the font task", () => {
    expect(globals).not.toMatch(/--font-(display|sans|mono|wordmark):/);
  });

  const colors = Object.entries(designColors()).filter(([key]) => !key.startsWith("admin-"));

  it("reads the DESIGN.md colours", () => {
    expect(colors.length).toBeGreaterThan(40);
  });

  it.each(colors)("DESIGN.md colour %s resolves to --color-%s with the same hex", (key, hex) => {
    const m = globals.match(new RegExp(`--color-${key}: ([^;]+);`));
    expect(m, `--color-${key} is missing`).not.toBeNull();
    const value = m![1]!;
    if (value.startsWith("var(")) {
      const ref = value.slice(4, -1);
      expect(globals.toLowerCase()).toContain(`${ref}: ${hex.toLowerCase()};`);
    } else {
      expect(value.toLowerCase()).toBe(hex.toLowerCase());
    }
  });

  it("maps the shadcn roles per DESIGN.md", () => {
    expect(globals).toContain("--primary: var(--color-forest-800);");
    expect(globals).toContain("--ring: var(--color-forest-700);");
    expect(globals).toContain("--radius: 0.875rem;");
  });

  it("[C13] no stylesheet reads the bare --line-strong", () => {
    const files = globSync("src/**/*.css", { cwd: root });
    expect(files.length).toBeGreaterThan(1);
    for (const file of files) {
      expect(read(file), file).not.toContain("var(--line-strong)");
    }
  });
});
