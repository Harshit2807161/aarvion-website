import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";

// Only public/foil and public/banners carry per-file provenance sidecars here.
// public/brand/** has its own README and public/products is handled by
// sync-product-images, so neither is checked by this test.
const root = path.resolve(import.meta.dirname, "..", "public");

const FOIL = [
  "foil-plate",
  "foil-knurl-print",
  "foil-knurl-print-1x",
  "dome-hero",
  "dome-hero-m",
  "dome-floor",
].map((n) => `${n}.webp`);

const SCENES = ["sacuwin", "eye", "rx", "delivery"];
const BANNERS = SCENES.flatMap((s) => [`${s}-1792.webp`, `${s}-m.webp`]);
const BANNER_SIZES: Record<string, [number, number]> = {
  "-1792": [1792, 588],
  "-m": [840, 472],
};

function rasters(dir: string): string[] {
  return readdirSync(path.join(root, dir))
    .filter((f) => f.endsWith(".webp"))
    .sort();
}

function sidecar(dir: string, file: string): Record<string, unknown> {
  return JSON.parse(readFileSync(path.join(root, dir, `${file}.json`), "utf8"));
}

describe.each([
  ["foil", FOIL],
  ["banners", BANNERS],
] as const)("public/%s", (dir, expected) => {
  it("holds exactly the named rasters", () => {
    expect(rasters(dir)).toEqual([...expected].sort());
  });

  it("has no stray files besides rasters and their sidecars", () => {
    const names = readdirSync(path.join(root, dir)).sort();
    const allowed = expected.flatMap((f) => [f, `${f}.json`]).sort();
    expect(names).toEqual(allowed);
  });

  it.each(expected)("%s has a provenance sidecar", (file) => {
    expect(existsSync(path.join(root, dir, `${file}.json`))).toBe(true);
    const meta = sidecar(dir, file);
    expect(typeof meta.prompt).toBe("string");
    expect(typeof meta.createdAt).toBe("string");
  });

  it.each(expected)("%s matches its recorded pixels", async (file) => {
    const meta = sidecar(dir, file);
    if (!Array.isArray(meta.pixels)) return;
    const m = await sharp(path.join(root, dir, file)).metadata();
    expect([m.width, m.height]).toEqual(meta.pixels);
  });
});

describe("public/banners specifics", () => {
  it.each(BANNERS)("%s is composited by the store banner script", (file) => {
    expect(sidecar("banners", file).generator).toBe(
      "scripts/composite_store_banners.py",
    );
  });

  it.each(BANNERS)("%s is <= 120000 bytes and the right size", async (file) => {
    const p = path.join(root, "banners", file);
    expect(statSync(p).size).toBeLessThanOrEqual(120_000);
    const key = file.includes("-1792") ? "-1792" : "-m";
    const m = await sharp(p).metadata();
    expect([m.width, m.height]).toEqual(BANNER_SIZES[key]);
  });
});
