import { describe, expect, it } from "vitest";
import { highlight } from "./highlight";

describe("highlight", () => {
  it("marks each token case-insensitively and keeps the text between", () => {
    expect(highlight("Sacubitril (as sodium) 49 mg + Valsartan 51 mg", ["sacu", "val"])).toEqual([
      { text: "Sacu", mark: true },
      { text: "bitril (as sodium) 49 mg + ", mark: false },
      { text: "Val", mark: true },
      { text: "sartan 51 mg", mark: false },
    ]);
  });

  it("merges overlapping and touching tokens into one mark", () => {
    expect(highlight("Valsartan", ["vals", "sart"])).toEqual([
      { text: "Valsart", mark: true },
      { text: "an", mark: false },
    ]);
    expect(highlight("Valsartan", ["val", "sar"])).toEqual([
      { text: "Valsar", mark: true },
      { text: "tan", mark: false },
    ]);
  });

  it("marks every occurrence of a token", () => {
    expect(highlight("aXa", ["a"])).toEqual([
      { text: "a", mark: true },
      { text: "X", mark: false },
      { text: "a", mark: true },
    ]);
  });

  it("returns the whole text unmarked when nothing matches, and nothing for empty text", () => {
    expect(highlight("Telma", ["zzz", ""])).toEqual([{ text: "Telma", mark: false }]);
    expect(highlight("Telma", [])).toEqual([{ text: "Telma", mark: false }]);
    expect(highlight("", ["a"])).toEqual([]);
  });

  it("treats regex characters literally", () => {
    expect(highlight("a.b (x)", [".", "("])).toEqual([
      { text: "a", mark: false },
      { text: ".", mark: true },
      { text: "b ", mark: false },
      { text: "(", mark: true },
      { text: "x)", mark: false },
    ]);
  });
});
