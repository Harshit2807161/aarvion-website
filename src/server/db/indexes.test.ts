import { beforeEach, describe, expect, it } from "vitest";
import {
  getRegisteredIndexes,
  registerIndexes,
  resetIndexRegistryForTests,
  type NamedIndex,
} from "./indexes.ts";

beforeEach(() => resetIndexRegistryForTests());

describe("registerIndexes", () => {
  it("requires an explicit name", () => {
    expect(() => registerIndexes("x", [{ key: { a: 1 } } as unknown as NamedIndex])).toThrow(
      /explicit name/,
    );
    expect(() => registerIndexes("x", [{ key: { a: 1 }, name: "" }])).toThrow(/explicit name/);
  });

  it("ignores an identical re-registration (HMR)", () => {
    registerIndexes("x", [{ key: { a: 1 }, name: "a_1" }]);
    registerIndexes("x", [{ key: { a: 1 }, name: "a_1" }]);
    expect(getRegisteredIndexes("x")).toHaveLength(1);
  });

  it("rejects a reused name with a different spec", () => {
    registerIndexes("x", [{ key: { a: 1 }, name: "a_1" }]);
    expect(() => registerIndexes("x", [{ key: { b: 1 }, name: "a_1" }])).toThrow(
      /already registered/,
    );
  });

  it("allows the same name in different collections", () => {
    registerIndexes("x", [{ key: { a: 1 }, name: "a_1" }]);
    registerIndexes("y", [{ key: { b: 1 }, name: "a_1" }]);
    expect(getRegisteredIndexes("y")).toHaveLength(1);
  });
});
