import { globSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

const srcDir = resolve(fileURLToPath(import.meta.url), "../..");

it("exposes only appendAudit at runtime (append-only: no update or delete API)", async () => {
  expect(Object.keys(await import("./audit"))).toEqual(["appendAudit"]);
});

it("no other non-test source file touches the audit_logs collection", () => {
  const offenders = globSync("**/*.{ts,tsx}", { cwd: srcDir })
    .filter((f) => !/\.test\.tsx?$/.test(f) && f !== "server/audit.ts")
    .filter((f) => readFileSync(resolve(srcDir, f), "utf8").includes("audit_logs"));
  expect(offenders).toEqual([]);
});
