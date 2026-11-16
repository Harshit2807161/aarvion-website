import { globSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

const appDir = resolve(fileURLToPath(import.meta.url), "../../app");

it("every dev-only route or page calls requireDevRoute()", () => {
  const files = globSync("dev/**/{route.ts,page.tsx}", { cwd: appDir });
  expect(files.length).toBeGreaterThan(0);
  const missing = files.filter(
    (f) => !readFileSync(resolve(appDir, f), "utf8").includes("requireDevRoute()"),
  );
  expect(missing).toEqual([]);
});
