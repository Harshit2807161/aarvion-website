import { globSync, readFileSync } from "node:fs";
import { relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

const serverDir = resolve(fileURLToPath(import.meta.url), "../..");
const dbDir = resolve(serverDir, "db");

it("register-all.ts imports every module that calls registerIndexes", () => {
  const registerAll = readFileSync(resolve(dbDir, "register-all.ts"), "utf8");
  const files = globSync("**/*.ts", { cwd: serverDir })
    .filter((f) => !f.endsWith(".test.ts") && f !== "db/indexes.ts")
    .filter((f) => readFileSync(resolve(serverDir, f), "utf8").includes("registerIndexes("));
  expect(files.length).toBeGreaterThan(0);
  for (const f of files) {
    const rel = relative(dbDir, resolve(serverDir, f));
    expect(registerAll, f).toContain(`"${rel.startsWith(".") ? rel : `./${rel}`}"`);
  }
});
