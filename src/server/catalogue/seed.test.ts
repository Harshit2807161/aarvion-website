import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { ImageManifest } from "../../../scripts/sync-product-images.ts";
import { DEFAULT_MRP_PAISE } from "./pricing.ts";
import { CatalogueJson, Product, type ProductJson } from "./schema.ts";
import { toProductDoc } from "./seed.ts";

const repoRoot = resolve(fileURLToPath(import.meta.url), "../../../..");
const readJson = (f: string) => JSON.parse(readFileSync(resolve(repoRoot, f), "utf8"));
const catalogue = CatalogueJson.parse(readJson("data/products.json"));
const manifest = readJson("data/product-images.json") as ImageManifest;
const now = new Date("2026-11-17T00:00:00Z");
const json = (slug: string): ProductJson =>
  structuredClone(catalogue.products.find((p) => p.slug === slug)!);

describe("toProductDoc", () => {
  it("maps sacuwin-50", () => {
    const doc = toProductDoc(json("sacuwin-50"), manifest["sacuwin-50"]!, DEFAULT_MRP_PAISE, now);
    expect(doc.mrpPaise).toBe(28100);
    expect(doc.mrpSource).toBe("pack-back-panel");
    expect(doc.images).toHaveLength(3);
    expect(doc.images[0]!.src).toBe(manifest["sacuwin-50"]!.photos[0]!.src);
    expect(doc.images[0]!.alt).toBe("Sacuwin 50 pack, photo 1 of 3");
    expect(doc.cutout!.alt).toBe("Sacuwin 50 pack");
    expect(doc.internalNotes).toBeNull();
    expect(doc.createdAt).toBe(now);
    expect(doc.updatedAt).toBe(now);
    expect(doc).not.toHaveProperty("notes");
  });

  it("moves the hero image to the front", () => {
    const p = json("sacuwin-50");
    const m = manifest["sacuwin-50"]!;
    p.heroImage = m.photos[2]!.from;
    const doc = toProductDoc(p, m, DEFAULT_MRP_PAISE, now);
    expect(doc.images[0]!.src).toBe(m.photos[2]!.src);
    expect(doc.images.map((i) => i.alt)).toEqual([
      "Sacuwin 50 pack, photo 1 of 3",
      "Sacuwin 50 pack, photo 2 of 3",
      "Sacuwin 50 pack, photo 3 of 3",
    ]);
  });

  it("uses the default MRP when none is printed", () => {
    const p = { ...json("sacuwin-50"), mrpPaise: null, mrpSource: "default" as const };
    const doc = toProductDoc(p, manifest["sacuwin-50"]!, DEFAULT_MRP_PAISE, now);
    expect(doc.mrpPaise).toBe(40400);
    expect(doc.mrpSource).toBe("default");
  });

  it("keeps notes as internalNotes", () => {
    const p = json("bemptor-r40");
    expect(p.notes).toBeTruthy();
    expect(toProductDoc(p, manifest["bemptor-r40"]!, DEFAULT_MRP_PAISE, now).internalNotes).toBe(
      p.notes,
    );
  });

  it("throws when the hero is not in the manifest", () => {
    const p = { ...json("sacuwin-50"), heroImage: "assets/nope.webp" };
    expect(() => toProductDoc(p, manifest["sacuwin-50"]!, DEFAULT_MRP_PAISE, now)).toThrow(
      /sacuwin-50/,
    );
  });

  it("produces valid documents for all 11 products", () => {
    expect(catalogue.products).toHaveLength(11);
    for (const p of catalogue.products) {
      const doc = toProductDoc(p, manifest[p.slug]!, catalogue.defaultMrpPaise, now);
      expect(Product.safeParse(doc).success, p.slug).toBe(true);
    }
  });
});
