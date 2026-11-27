/**
 * Vercel build gate (review R3, I1b), run by `pnpm vercel-build` before `next build`. On Vercel
 * every scope must keep prescription files in a private Blob store: memory and local files do not
 * persist across functions and are refused at runtime, and that refusal surfaces only on the first
 * upload. Failing the build here makes a mis-set scope loud at deploy time. It names keys only,
 * never values. No imports beyond Node, so it runs with plain `node --experimental-strip-types`.
 */
type Env = Record<string, string | undefined>;
export type BuildProblem = { key: "FILE_STORE" | "BLOB_READ_WRITE_TOKEN"; message: string };

export function vercelBuildProblems(env: Env): BuildProblem[] {
  const onVercel = Boolean(env.VERCEL) || Boolean(env.VERCEL_ENV);
  if (!onVercel) return [];
  const problems: BuildProblem[] = [];
  if (env.FILE_STORE !== "blob") {
    problems.push({
      key: "FILE_STORE",
      message: "FILE_STORE must be blob on every Vercel scope (memory and local do not persist).",
    });
  }
  if (!env.BLOB_READ_WRITE_TOKEN) {
    problems.push({
      key: "BLOB_READ_WRITE_TOKEN",
      message: "BLOB_READ_WRITE_TOKEN is missing: connect this scope's private Blob store.",
    });
  }
  return problems;
}

if (import.meta.main) {
  const problems = vercelBuildProblems(process.env);
  for (const p of problems) console.error(`vercel-build gate: ${p.message}`);
  if (problems.length > 0) process.exit(1);
}
