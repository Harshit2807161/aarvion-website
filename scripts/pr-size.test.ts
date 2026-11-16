import { describe, expect, it } from "vitest";
import { countChangedLines, DEFAULT_EXCLUDES } from "./pr-size.ts";

describe("countChangedLines", () => {
  it("sums added and deleted lines", () => {
    expect(countChangedLines("10\t5\tsrc/a.ts\n3\t0\tsrc/b.ts\n", [])).toBe(18);
  });

  it("ignores excluded globs", () => {
    const numstat = [
      "500\t0\tpnpm-lock.yaml",
      "900\t10\tdata/products/x.json",
      "0\t0\tpublic/a.webp",
      "7\t7\tsrc/img/b.png",
      "40\t2\tpublic/icons/c.svg",
      "600\t0\tdocs/superpowers/plans/p.md",
      "80\t0\tdocs/decisions/0001-x.md",
      "4\t1\tsrc/keep.ts",
    ].join("\n");
    expect(countChangedLines(numstat, DEFAULT_EXCLUDES)).toBe(5);
  });

  it("counts binary rows as 0", () => {
    expect(countChangedLines("-\t-\tsrc/logo.bin\n2\t2\tsrc/a.ts", [])).toBe(4);
  });

  it("ignores files flagged as generated shadcn", () => {
    const numstat = "300\t0\tsrc/components/ui/button.tsx\n5\t0\tsrc/a.ts";
    const gen = (p: string) => p.includes("components/ui/");
    expect(countChangedLines(numstat, [], gen)).toBe(5);
  });
});
