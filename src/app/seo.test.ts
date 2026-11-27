import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/fonts", () => ({ fontVariables: "" }));

import { generateMetadata } from "./layout";

afterEach(() => vi.unstubAllEnvs());

describe("root metadata", () => {
  it("uses the storefront title and template, with no ₹20 lead", async () => {
    const m = await generateMetadata();
    const title = m.title as { default: string; template: string };
    expect(title.default).toBe("Aarvion Pharmaceuticals · Buy Aarvion medicines online");
    expect(title.template).toBe("%s · Aarvion Pharmaceuticals");
    expect(`${title.default} ${m.description}`).not.toMatch(/₹\s?20/);
  });
});
