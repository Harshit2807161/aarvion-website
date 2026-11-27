import { describe, expect, it } from "vitest";
import { traceProblems } from "./check-rx-trace";

const root = "/app";
const complete = [
  "/app/node_modules/pdf-lib",
  "/app/node_modules/.pnpm/pdf-lib@1.17.1/node_modules/pdf-lib/package.json",
  "/app/node_modules/.pnpm/sharp@0.35.5/node_modules/sharp/package.json",
  "/app/.next/server/assets/pdf-worker.41hbcb1afvrv0.mjs",
];

describe("traceProblems", () => {
  it("passes a trace with pdf-lib, its top-level link, sharp and the worker", () => {
    expect(traceProblems(complete, root)).toEqual([]);
  });

  it("names each missing piece", () => {
    for (let i = 0; i < complete.length; i++) {
      const files = complete.filter((_, j) => j !== i);
      expect(traceProblems(files, root)).toHaveLength(1);
    }
    expect(traceProblems([], root)).toHaveLength(4);
  });

  it("does not count a nested pdf-lib link as the one the worker resolves", () => {
    const files = complete.map((f) =>
      f === "/app/node_modules/pdf-lib" ? "/app/node_modules/x/node_modules/pdf-lib" : f,
    );
    expect(traceProblems(files, root)).toEqual([
      "node_modules/pdf-lib (the link the PDF worker resolves) is not traced",
    ]);
  });
});
