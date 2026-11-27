import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { runCommand } from "../helpers/run-script";

describe("int tests never block the event loop on a child process", () => {
  // The in-memory mongod writes its log to a pipe this worker drains. A synchronous spawn stops
  // the draining, mongod blocks on a full pipe, and the child it serves times out or hangs.
  it("no int test file uses spawnSync, execSync or execFileSync while it runs a replica set", () => {
    const dir = "tests/int";
    const offenders = readdirSync(dir)
      .filter((f) => f.endsWith(".test.ts"))
      .filter((f) => {
        const src = readFileSync(join(dir, f), "utf8");
        return (
          src.includes("startMemoryReplSet") &&
          /import[^;]*\b(spawnSync|execSync|execFileSync)\b[^;]*from "node:child_process"/.test(src)
        );
      });
    expect(offenders).toEqual([]);
  });
});

describe("runCommand", () => {
  it("returns the exit status and output", async () => {
    const r = await runCommand(process.execPath, [
      "-e",
      "console.log('out'); console.error('err'); process.exit(3)",
    ]);
    expect(r).toMatchObject({ status: 3, signal: null, timedOut: false });
    expect(r.stdout).toBe("out\n");
    expect(r.stderr).toBe("err\n");
  });

  it("kills a child that never exits, with its children, and says so", async () => {
    const started = Date.now();
    // The child spawns a grandchild that would outlive a plain kill of its parent.
    const script = `require("node:child_process").spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], { stdio: "inherit" }); setInterval(() => {}, 1000);`;
    const r = await runCommand(process.execPath, ["-e", script], { timeoutMs: 500 });
    expect(r.timedOut).toBe(true);
    expect(r.status).toBeNull();
    expect(r.stderr).toContain("timed out after 500 ms");
    expect(Date.now() - started).toBeLessThan(5_000);
  });
});
