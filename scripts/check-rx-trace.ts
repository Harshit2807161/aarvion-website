/**
 * Build-output guard (review R5 I4), run by CI after `pnpm build`: the prescription upload routes
 * must ship what the file check loads at run time, which no bundler step proves.
 * - `pdf-lib`: the PDF worker (`pdf-worker.*.mjs`, a plain asset) imports it at run time, so it
 *   must be traced through the top-level `node_modules/pdf-lib` link the worker resolves.
 * - `sharp`: `file-check.ts` loads it with `createRequire`, so the native package must be traced.
 * - the worker asset itself.
 * Without them every PDF (or image) would be refused on Vercel while every test stays green.
 * Plain Node, no imports beyond node:, so it runs with `node --experimental-strip-types`.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

/** The routes whose module graph reaches `checkRxFile`. */
export const RX_TRACED_ROUTES = [
  "api/prescriptions/route",
  "api/prescriptions/staging/route",
  "api/prescriptions/staging/[id]/route",
];

/** What is missing from one route's trace; `files` are absolute paths. */
export function traceProblems(files: string[], root: string): string[] {
  const problems: string[] = [];
  if (!files.includes(resolve(root, "node_modules/pdf-lib"))) {
    problems.push("node_modules/pdf-lib (the link the PDF worker resolves) is not traced");
  }
  if (!files.some((f) => /\/pdf-lib\/package\.json$/.test(f))) {
    problems.push("the pdf-lib package is not traced");
  }
  if (!files.some((f) => /\/sharp\/package\.json$/.test(f))) {
    problems.push("the sharp package is not traced");
  }
  if (!files.some((f) => /\/assets\/pdf-worker\.[^/]+\.mjs$/.test(f))) {
    problems.push("the pdf-worker.*.mjs asset is not traced");
  }
  return problems;
}

/** Reads each route's `.nft.json` under `.next/server/app` and returns every problem, named by route. */
export function checkRxTrace(root: string): string[] {
  return RX_TRACED_ROUTES.flatMap((route) => {
    const nft = resolve(root, ".next/server/app", `${route}.js.nft.json`);
    if (!existsSync(nft)) return [`${route}: no trace file (run pnpm build first)`];
    const { files } = JSON.parse(readFileSync(nft, "utf8")) as { files: string[] };
    const abs = files.map((f) => resolve(dirname(nft), f));
    return traceProblems(abs, root).map((p) => `${route}: ${p}`);
  });
}

if (import.meta.main) {
  const problems = checkRxTrace(process.cwd());
  for (const p of problems) console.error(`rx trace check: ${p}`);
  if (problems.length > 0) process.exit(1);
  console.log(`rx trace check: ${RX_TRACED_ROUTES.length} routes ship pdf-lib, sharp and the worker`);
}
