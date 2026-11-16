import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { CatalogueJson } from "../src/server/catalogue/schema.ts";
import { planImageSync } from "./sync-product-images.ts";

const root = process.cwd();
const catalogue = CatalogueJson.parse(
  JSON.parse(readFileSync(resolve(root, "data/products.json"), "utf8")),
);
const committed = JSON.parse(
  readFileSync(resolve(root, "data/product-images.json"), "utf8"),
);

describe("planImageSync", () => {
  it("matches the committed manifest (run pnpm images:sync after changing a photo)", async () => {
    const { manifest } = await planImageSync(catalogue, root);
    expect(manifest).toEqual(committed);
  });

  it("has every target file on disk", async () => {
    const { copies } = await planImageSync(catalogue, root);
    expect(copies.length).toBeGreaterThan(0);
    for (const c of copies) expect(existsSync(resolve(root, c.to)), c.to).toBe(true);
  });

  it("hashes names, counts photos and records dimensions", async () => {
    const { manifest } = await planImageSync(catalogue, root);
    expect(manifest["sacuwin-50"]!.photos).toHaveLength(3);
    expect(manifest["mucohelp"]!.photos).toHaveLength(2);
    expect(manifest["sacuwin-50"]!.photos[0]).toMatchObject({ width: 1000, height: 1000 });
    for (const [slug, entry] of Object.entries(manifest)) {
      for (const p of entry.photos) {
        expect(p.src).toMatch(new RegExp(`^/products/${slug}/[0-9a-f]{8}\\.webp$`));
      }
      expect(entry.cutout?.src).toMatch(
        new RegExp(`^/products/${slug}/cutout-[0-9a-f]{8}\\.webp$`),
      );
    }
  });

  it("keeps products.json order and the exact repo-relative source string in from", async () => {
    const { manifest } = await planImageSync(catalogue, root);
    for (const p of catalogue.products) {
      expect(manifest[p.slug]!.photos.map((x) => x.from)).toEqual(p.images);
      expect(manifest[p.slug]!.cutout?.from).toBe(`assets/products/cutout/${p.slug}.webp`);
    }
  });
});
