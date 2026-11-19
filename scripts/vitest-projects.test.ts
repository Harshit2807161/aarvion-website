import { globSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import config from "../vitest.config.ts";

type Project = { test?: { name?: string; include?: string[]; exclude?: string[] } };

const root = path.resolve(import.meta.dirname, "..");
const projects = (config.test?.projects ?? []) as Project[];
const files = ["src", "scripts", "tests"].flatMap((dir) =>
  globSync(`${dir}/**/*.test.{ts,tsx}`, { cwd: root, exclude: (n) => n === "node_modules" }),
);

describe("vitest projects", () => {
  it("finds the test files to check", () => {
    expect(files.length).toBeGreaterThan(5);
  });

  it.each(files.map((f) => [f]))("%s belongs to exactly one project", (file) => {
    const owners = projects
      .filter((p) => {
        const { include = [], exclude = [] } = p.test ?? {};
        return (
          include.some((g) => path.matchesGlob(file, g)) &&
          !exclude.some((g) => path.matchesGlob(file, g))
        );
      })
      .map((p) => p.test?.name);
    expect(owners).toHaveLength(1);
  });
});
