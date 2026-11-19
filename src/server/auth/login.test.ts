import { describe, expect, it } from "vitest";
import { SignupInput } from "./login.ts";

const name = SignupInput.shape.name;

// Escapes only: the source must never hold the invisible characters it tests.
describe("SignupInput name rule", () => {
  it.each([
    ["Latin", "Ravi Kumar", "Ravi Kumar"],
    ["accented Latin", "José Ñúñez", "José Ñúñez"],
    ["Devanagari", "\u092A\u094D\u0930\u093F\u092F\u093E", "\u092A\u094D\u0930\u093F\u092F\u093E"],
    ["Marathi eyelash ra (ZWJ after a virama)", "\u0906\u0930\u094D\u200D\u092F\u093E", null],
    ["an explicit virama (ZWNJ after a virama)", "\u0926\u094D\u200C\u0935\u093E", null],
    ["ZWJ before a mark", "\u0915\u200D\u094D\u0937", null],
    ["surrounding spaces, trimmed", "  Asha Rao  ", "Asha Rao"],
  ])("accepts %s", (_what, input, stored) => {
    const parsed = name.safeParse(input);
    expect(parsed.success).toBe(true);
    expect(parsed.data).toBe(stored ?? input);
  });

  it.each([
    ["one letter", "A"],
    ["one letter padded", "   A   "],
    ["no letter", "12345"],
    ["over 80 characters", "x".repeat(81)],
    ["zero-width spaces", "\u200BA\u200B"],
    ["a right-to-left override", "Asha \u202ERao"],
    ["a newline", "Asha\nRao"],
    ["a word joiner", "Ra\u2060vi"],
    ["a byte-order mark", "Ra\uFEFFvi"],
    ["a soft hyphen", "Ra\u00ADvi"],
    ["Hangul fillers (blank letters)", "\u3164\u3164"],
    ["a combining grapheme joiner", "Ra\u034Fvi"],
    ["a leading ZWJ", "\u200DRavi"],
    ["a trailing ZWJ", "Ravi\u200D"],
    ["a doubled ZWJ", "\u0906\u0930\u094D\u200D\u200D\u092F\u093E"],
    ["ZWJ then ZWNJ", "\u0906\u0930\u094D\u200D\u200C\u092F\u093E"],
    ["a ZWJ before a space", "Asha\u200D Rao"],
    ["a ZWJ after a space", "Asha \u200DRao"],
    ["a ZWJ beside a digit", "Ravi\u200D1"],
    ["a leading ZWNJ", "\u200CRavi"],
    ["a trailing ZWNJ", "Ravi\u200C"],
    ["a ZWNJ beside a space", "Asha\u200C Rao"],
    ["a ZWNJ beside a digit", "1\u200CRavi"],
  ])("refuses %s", (_what, input) => {
    expect(name.safeParse(input).success).toBe(false);
  });
});
