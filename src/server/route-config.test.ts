import { globSync, readFileSync } from "node:fs";
import { matchesGlob, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// Global Constraints [C8]: under Cache Components a GET handler starts with `await connection()`
// (anything it reads first would abort the prerender), a dev GET calls `requireDevRoute()` next,
// and the old segment configs are banned.
const appDir = resolve(fileURLToPath(import.meta.url), "../../app");
const ROUTE_GLOB = "**/route.{ts,tsx,js,mjs}";
const routes = globSync(ROUTE_GLOB, { cwd: appDir }).map((f) => ({
  file: f,
  src: readFileSync(resolve(appDir, f), "utf8"),
}));

const BANNED = /export\s+const\s+(dynamic|revalidate|fetchCache)\b/;
const GET_EXPORT = /export\s+(?:async\s+)?(?:function|const|let)\s+GET\b|export\s*\{[^}]*\bGET\b/g;
const GET_BODY = [
  /export\s+async\s+function\s+GET\s*\([^)]*\)\s*(?::[^{]*)?\{/g,
  /export\s+const\s+GET\s*=\s*(?:\w+\(\s*)?async\s*\([^)]*\)\s*(?::[^=]*)?=>\s*\{/g,
];
const FIRST_TWO = /^\s*(await connection\(\);)\s*([^;]*;)?/;

/** The first two statements of each exported GET body; null where the export has another shape. */
function getBodies(src: string): ({ first: string; second: string } | null)[] {
  const bodies = GET_BODY.flatMap((re) => [...src.matchAll(re)]).map((m) => {
    const head = FIRST_TWO.exec(src.slice(m.index + m[0].length));
    return head ? { first: head[1]!, second: head[2] ?? "" } : null;
  });
  const exports = [...src.matchAll(GET_EXPORT)].length;
  return bodies.length === exports ? bodies : [...bodies, null];
}

describe("route handler config", () => {
  it("finds the route files and their GET handlers", () => {
    expect(routes.length).toBeGreaterThan(0);
    expect(routes.flatMap(({ src }) => getBodies(src)).length).toBeGreaterThan(0);
  });

  it.each(routes.map((r) => [r.file, r.src]))("%s has no banned segment config", (_f, src) => {
    expect(src).not.toMatch(BANNED);
  });

  it.each(routes.map((r) => [r.file, r.src]))(
    "%s: every GET starts with await connection()",
    (file, src) => {
      const bodies = getBodies(src);
      if (bodies.length === 0) return;
      expect(src).toMatch(/import\s*\{[^}]*\bconnection\b[^}]*\}\s*from\s*"next\/server"/);
      for (const body of bodies) {
        expect(body).not.toBeNull();
        if (file.startsWith("dev/")) expect(body!.second).toContain("requireDevRoute()");
      }
    },
  );

  it("rejects the shapes it guards against", () => {
    const ok = `export async function GET(req: Request): Promise<Response> {\n  await connection();\n  requireDevRoute();`;
    expect(getBodies(ok)).toEqual([{ first: "await connection();", second: "requireDevRoute();" }]);
    expect(
      getBodies("export const GET = withErrors(async (req) => {\n  await connection();"),
    ).toHaveLength(1);
    expect(
      getBodies("export async function GET() {\n  const v = 1;\n  await connection();"),
    ).toEqual([null]);
    expect(getBodies("export function GET() {\n  return new Response();")).toEqual([null]);
    expect(getBodies("const GET = async () => {};\nexport { GET };")).toEqual([null]);
    expect("export const dynamic = 'force-dynamic';").toMatch(BANNED);
    for (const f of ["api/x/route.ts", "api/x/route.tsx", "dev/route.js", "route.mjs"]) {
      expect(matchesGlob(f, ROUTE_GLOB)).toBe(true);
    }
  });
});
