import { spawnSync } from "node:child_process";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { vercelBuildProblems } from "./vercel-build-gate.ts";

const TOKEN = "vercel_blob_rw_test_not_a_secret";
const GATE = path.join(import.meta.dirname, "vercel-build-gate.ts");

/** Runs the gate as Vercel would, with only PATH and the given variables. */
function runGate(vars: Record<string, string>) {
  const env = { PATH: process.env.PATH ?? "", ...vars } as unknown as NodeJS.ProcessEnv;
  return spawnSync(process.execPath, ["--experimental-strip-types", "--no-warnings", GATE], {
    env,
    encoding: "utf8",
  });
}

describe("vercelBuildProblems (review R3, I1b)", () => {
  it("passes outside Vercel whatever the file store", () => {
    expect(vercelBuildProblems({ FILE_STORE: "memory" })).toEqual([]);
  });
  it("passes on Vercel with FILE_STORE=blob and a token", () => {
    expect(
      vercelBuildProblems({ VERCEL: "1", FILE_STORE: "blob", BLOB_READ_WRITE_TOKEN: TOKEN }),
    ).toEqual([]);
  });
  it.each([
    [{ VERCEL: "1" }, ["FILE_STORE", "BLOB_READ_WRITE_TOKEN"]],
    [{ VERCEL: "1", FILE_STORE: "memory", BLOB_READ_WRITE_TOKEN: TOKEN }, ["FILE_STORE"]],
    [{ VERCEL_ENV: "preview", FILE_STORE: "local" }, ["FILE_STORE", "BLOB_READ_WRITE_TOKEN"]],
    [{ VERCEL: "1", FILE_STORE: "blob", BLOB_READ_WRITE_TOKEN: "" }, ["BLOB_READ_WRITE_TOKEN"]],
  ])("fails %o naming %o, never a value", (env, keys) => {
    const problems = vercelBuildProblems(env);
    expect(problems.map((p) => p.key)).toEqual(keys);
    expect(JSON.stringify(problems)).not.toContain(TOKEN);
  });
  it("exits 1 with the problems on stderr when run on Vercel without a Blob store", () => {
    const res = runGate({ VERCEL: "1", FILE_STORE: "memory" });
    expect(res.status).toBe(1);
    expect(res.stderr).toMatch(/FILE_STORE/);
    expect(res.stderr).toMatch(/BLOB_READ_WRITE_TOKEN/);
  });
  it("exits 0 when the store is set", () => {
    const res = runGate({ VERCEL: "1", FILE_STORE: "blob", BLOB_READ_WRITE_TOKEN: TOKEN });
    expect(res.status).toBe(0);
  });
});
