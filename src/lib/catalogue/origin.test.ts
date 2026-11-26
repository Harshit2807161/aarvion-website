import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { countryOfOrigin } from "./origin";

const { products } = JSON.parse(readFileSync("data/products.json", "utf8")) as {
  products: { slug: string; manufacturer: string | null }[];
};

describe("countryOfOrigin", () => {
  const withMaker = products.filter((p) => p.manufacturer !== null);

  it("covers the nine manufactured products in the seed", () => {
    expect(withMaker).toHaveLength(9);
  });

  it.each(withMaker.map((p) => [p.slug, p.manufacturer!]))("%s is made in India", (_s, m) => {
    expect(countryOfOrigin(m)).toBe("India");
  });

  it("matches markers as whole words in any case", () => {
    expect(countryOfOrigin("Unit 2, HARIDWAR 249403")).toBe("India");
    expect(countryOfOrigin("Plot 1, Baddi, Solan (hp) 173205")).toBe("India");
    expect(countryOfOrigin("12 Punjabi Bagh, Mumbai")).toBeNull();
  });

  it("does not trust a six-digit number or a street name", () => {
    expect(countryOfOrigin("1 Delhi Street, London 123456")).toBeNull();
    expect(countryOfOrigin("Block 5, Singapore 560123")).toBeNull();
  });

  it("reads Oloage-KT (no PIN code) from its Haridwar marker", () => {
    const m = products.find((p) => p.slug === "oloage-kt")!.manufacturer!;
    expect(m).not.toMatch(/\b[1-9]\d{5}\b/);
    expect(countryOfOrigin(m)).toBe("India");
  });

  it("is null when the manufacturer is unknown", () => {
    expect(countryOfOrigin(null)).toBeNull();
  });

  it("never guesses: foreign or unplaceable addresses give null", () => {
    expect(countryOfOrigin("Acme GmbH, Musterstraße 1, 10115 Berlin")).toBeNull();
    expect(countryOfOrigin("Unit 4, Mumbai")).toBeNull();
  });
});
