import { globSync, readFileSync } from "node:fs";
import { relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

const serverDir = resolve(fileURLToPath(import.meta.url), "../..");
const dbDir = resolve(serverDir, "db");

/** Side-effect import specifiers (`import "x";`), matched only at line start. */
function sideEffectImports(src: string): string[] {
  return [...src.matchAll(/^import\s+(["'])([^"'\n]+)\1\s*;?\s*$/gm)].map((m) => m[2]!);
}

it("parses only real import statements", () => {
  const src = '// import "../a.ts";\nimport "../b.ts";\nimport \'../c.ts\';\n  import "../d.ts";\n';
  expect(sideEffectImports(src)).toEqual(["../b.ts", "../c.ts"]);
});

it("register-all.ts imports every module that calls registerIndexes", () => {
  const imports = sideEffectImports(readFileSync(resolve(dbDir, "register-all.ts"), "utf8"));
  const files = globSync("**/*.ts", { cwd: serverDir })
    .filter((f) => !f.endsWith(".test.ts") && f !== "db/indexes.ts")
    .filter((f) => /^\s*registerIndexes\(/m.test(readFileSync(resolve(serverDir, f), "utf8")));
  expect(files.length).toBeGreaterThan(0);
  for (const f of files) {
    const rel = relative(dbDir, resolve(serverDir, f));
    expect(imports, f).toContain(rel.startsWith(".") ? rel : `./${rel}`);
  }
});
