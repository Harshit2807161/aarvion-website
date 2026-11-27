import { globSync, readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

/**
 * Global Constraints: client-reachable code (`src/components/**`, and `src/lib/**` but for its
 * server-only modules) imports at runtime from `src/server/**` only the pure, framework-free
 * `catalogue/pricing`, `catalogue/search`, `catalogue/order` and `cart/rules`. Anything else there may pull
 * Mongo, env or auth code into a client bundle, so it may be imported only with a statement-level
 * `import type` (or `export type`), which is always erased. An inline `import { type X }` is not enough: depending on the compiler settings
 * it can leave a side-effect import of the module behind.
 */
const root = path.resolve(import.meta.dirname, "../..");
const serverDir = path.join(root, "src/server");
const ALLOWED = new Set(["catalogue/pricing", "catalogue/search", "catalogue/order", "cart/rules"]);

/** The module path under src/server that `specifier` names from `file`, or null if it is not one. */
function serverModule(specifier: string, file: string): string | null {
  let target: string;
  if (specifier === "@/server" || specifier.startsWith("@/server/")) {
    target = path.join(serverDir, specifier.slice("@/server".length));
  } else if (specifier.startsWith(".")) {
    target = path.resolve(root, path.dirname(file), specifier);
  } else return null;
  const rel = path.relative(serverDir, target);
  if (rel.startsWith("..") || path.isAbsolute(rel)) return null;
  return rel
    .split(path.sep)
    .join("/")
    .replace(/\.tsx?$/, "");
}

/** Every specifier in `source` that reaches a disallowed src/server module at runtime. */
function runtimeServerImports(source: string, file: string): string[] {
  const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const hits: string[] = [];
  const check = (spec: ts.Expression | undefined, typeOnly: boolean) => {
    if (!spec || !ts.isStringLiteralLike(spec) || typeOnly) return;
    const mod = serverModule(spec.text, file);
    if (mod !== null && !ALLOWED.has(mod)) hits.push(spec.text);
  };
  const visit = (node: ts.Node) => {
    if (ts.isImportDeclaration(node)) {
      check(node.moduleSpecifier, node.importClause?.isTypeOnly ?? false);
    } else if (ts.isExportDeclaration(node)) {
      check(node.moduleSpecifier, node.isTypeOnly);
    } else if (
      ts.isImportEqualsDeclaration(node) &&
      ts.isExternalModuleReference(node.moduleReference)
    ) {
      check(node.moduleReference.expression, node.isTypeOnly);
    } else if (
      ts.isCallExpression(node) &&
      (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(node.expression) && node.expression.text === "require"))
    ) {
      check(node.arguments[0], false);
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return hits;
}

/** Server-only modules under src/lib (they read the DB or env); every other src/lib file is held to the rule. */
const SERVER_ONLY_LIB = new Set([
  "src/lib/catalogue/cached.ts",
  "src/lib/catalogue/errors.ts",
  "src/lib/site-url.ts",
]);
const files = [
  ...globSync("src/components/**/*.{ts,tsx}", { cwd: root }),
  ...globSync("src/lib/**/*.{ts,tsx}", { cwd: root }).filter(
    (f) => !SERVER_ONLY_LIB.has(f.split(path.sep).join("/")),
  ),
].filter((f) => !/\.test\.tsx?$/.test(f));

describe("client-reachable code imports no server runtime", () => {
  it("scans the component and client-safe lib sources", () => {
    expect(files.length).toBeGreaterThan(10);
    expect(files).toContain(path.join("src", "components", "base", "stamp-price.tsx"));
    expect(files).toContain(path.join("src", "lib", "catalogue", "display.ts"));
    expect(files).not.toContain(path.join("src", "lib", "catalogue", "cached.ts"));
  });

  it.each(files.map((f) => [f]))("%s", (file) => {
    expect(runtimeServerImports(readFileSync(path.join(root, file), "utf8"), file)).toEqual([]);
  });
});

describe("runtimeServerImports", () => {
  const at = path.join("src", "components", "base", "x.tsx");
  const hits = (source: string) => runtimeServerImports(source, at);

  it("flags a runtime import of auth code", () => {
    expect(hits('import { login } from "@/server/auth/login";')).toEqual(["@/server/auth/login"]);
  });

  it("allows the pure catalogue modules, and type-only imports of anything", () => {
    expect(
      hits(`
        import { percentOff } from "@/server/catalogue/pricing";
        import { queryTokens } from "@/server/catalogue/search.ts";
        import { compareVariants } from "../../server/catalogue/order";
        import { addLine } from "@/server/cart/rules";
        import type { Category } from "@/server/catalogue/schema";
        import type { PublicProduct } from "../../server/catalogue/queries";
        export type { Session } from "@/server/auth/sessions";
        import { cn } from "@/lib/cn";
        import Image from "next/image";
      `),
    ).toEqual([]);
  });

  it("flags every other way of reaching src/server at runtime", () => {
    expect(
      hits(`
        import { login } from "../../server/auth/login";
        import "@/server/env";
        import { type Category } from "@/server/catalogue/schema";
        export { getDb } from "@/server/db/client";
        const q = await import("@/server/catalogue/queries");
        const deps = require("../../server/deps");
        import { getCart } from "@/server/cart/carts";
      `),
    ).toEqual([
      "../../server/auth/login",
      "@/server/env",
      "@/server/catalogue/schema",
      "@/server/db/client",
      "@/server/catalogue/queries",
      "../../server/deps",
      "@/server/cart/carts",
    ]);
  });

  it("ignores relative paths that stay outside src/server", () => {
    expect(hits('import { x } from "../serverless/thing";')).toEqual([]);
    expect(hits('import { x } from "./server";')).toEqual([]);
  });
});
