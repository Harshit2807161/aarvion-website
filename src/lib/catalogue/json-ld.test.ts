import { describe, expect, it } from "vitest";
import { publicCatalogue } from "../../../tests/helpers/catalogue";
import { findClaims } from "../../../tests/helpers/claims";
import { jsonLdScript, productJsonLd, productMetadata } from "./json-ld";

const base = new URL("https://aarvion.example");
const catalogue = publicCatalogue();
const bySlug = (s: string) => catalogue.find((p) => p.slug === s)!;

describe("productJsonLd", () => {
  it("states sacuwin-100 exactly, at the selling price", () => {
    const p = bySlug("sacuwin-100");
    expect(productJsonLd(p, base)).toEqual({
      "@context": "https://schema.org",
      "@type": "Product",
      name: "Sacuwin 100",
      sku: "sacuwin-100",
      image: p.images.map((i) => new URL(i.src, base).href),
      description: "Sacubitril (as sodium) 49 mg + Valsartan 51 mg. Strip of 14 tablets.",
      brand: { "@type": "Brand", name: "Aarvion Pharmaceuticals" },
      manufacturer: { "@type": "Organization", name: "Mascot Health Series Pvt. Ltd." },
      offers: {
        "@type": "Offer",
        url: "https://aarvion.example/product/sacuwin-100",
        priceCurrency: "INR",
        price: "387.00",
        itemCondition: "https://schema.org/NewCondition",
      },
    });
  });

  it("names no manufacturer when the catalogue has none", () => {
    expect(productJsonLd(bySlug("hyloage"), base)).not.toHaveProperty("manufacturer");
  });

  it.each(catalogue.map((p) => [p.slug]))("%s claims no stock, rating or review", (slug) => {
    const json = JSON.stringify(productJsonLd(bySlug(slug), base));
    for (const key of ["availability", "aggregateRating", "review"]) {
      expect(json).not.toContain(key);
    }
  });
});

describe("jsonLdScript", () => {
  it("never emits a closing script tag, whatever the data holds", () => {
    const out = jsonLdScript({ name: "</script><script>alert(1)</script>" });
    expect(out).not.toContain("</script>");
    expect(JSON.parse(out).name).toBe("</script><script>alert(1)</script>");
  });
});

describe("productMetadata", () => {
  it("titles with the name and the actives, and states MRP and price", () => {
    const m = productMetadata(bySlug("sacuwin-100"));
    expect(m.title).toBe("Sacuwin 100, Sacubitril 49 mg + Valsartan 51 mg");
    expect(m.description).toBe(
      "MRP ₹407, our price ₹387. Strip of 14 tablets. Needs a valid prescription; a pharmacist checks every order.",
    );
    expect(m.alternates?.canonical).toBe("/product/sacuwin-100");
    expect(m.openGraph).toMatchObject({
      title: m.title,
      description: m.description,
      url: "/product/sacuwin-100",
    });
    expect(m.openGraph?.images).toEqual([
      expect.objectContaining({ url: bySlug("sacuwin-100").images[0]!.src }),
    ]);
  });

  it("leaves the prescription sentence out when none is required", () => {
    const m = productMetadata({ ...bySlug("sacuwin-100"), rxRequired: false });
    expect(m.description).toBe("MRP ₹407, our price ₹387. Strip of 14 tablets.");
  });

  it.each(catalogue.map((p) => [p.slug]))("%s makes no banned claim", (slug) => {
    const m = productMetadata(bySlug(slug));
    expect(findClaims(`${m.title} ${m.description}`)).toEqual([]);
  });
});
