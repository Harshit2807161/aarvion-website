import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const script = resolve(process.cwd(), "scripts/pr-size.ts");
let dir: string;

function git(...args: string[]) {
  execFileSync("git", args, { cwd: dir, stdio: "pipe" });
}

function lines(n: number, prefix = "line") {
  return Array.from({ length: n }, (_, i) => `${prefix} ${i}`).join("\n") + "\n";
}

function runCli() {
  return spawnSync(
    process.execPath,
    ["--experimental-strip-types", "--no-warnings", script, "main"],
    { cwd: dir, encoding: "utf8" },
  );
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "pr-size-"));
  git("init", "-q", "-b", "main");
  git("config", "user.email", "t@example.com");
  git("config", "user.name", "t");
  git("config", "commit.gpgsign", "false");
  writeFileSync(join(dir, "README.md"), "hi\n");
  git("add", ".");
  git("commit", "-q", "-m", "init");
  git("checkout", "-q", "-b", "feat/x");
});

afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe("pr-size CLI", () => {
  it("exits 1 for a 401-line change", () => {
    writeFileSync(join(dir, "big.ts"), lines(401));
    git("add", ".");
    git("commit", "-q", "-m", "big");
    const r = runCli();
    expect(r.status).toBe(1);
    expect(r.stdout).toContain("401");
  });

  it("exits 0 at 400 lines", () => {
    writeFileSync(join(dir, "ok.ts"), lines(400));
    git("add", ".");
    git("commit", "-q", "-m", "ok");
    expect(runCli().status).toBe(0);
  });

  it("ignores lockfile, data and generated shadcn files", () => {
    mkdirSync(join(dir, "data"));
    mkdirSync(join(dir, "ui"));
    writeFileSync(join(dir, "pnpm-lock.yaml"), lines(900));
    writeFileSync(join(dir, "data/p.json"), lines(900));
    writeFileSync(join(dir, "ui/button.tsx"), "// @generated shadcn\n" + lines(900));
    writeFileSync(join(dir, "small.ts"), lines(3));
    git("add", ".");
    git("commit", "-q", "-m", "mixed");
    const r = runCli();
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("Changed lines: 3");
  });
});
