import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";

// The official logo (see public/brand/README.md): traced SVGs, their PNG exports and the app icons.
const root = path.resolve(import.meta.dirname, "..");
const brand = path.join(root, "public/brand");
const LOGO_COLOURS = ["#68C7A7", "#045487", "#1F3D2B", "#FFFFFF"]; // mint, navy, forest, white

const svgs = readdirSync(brand).filter((f) => f.endsWith(".svg"));

describe("public/brand SVGs", () => {
  it("holds the six logo variants", () => {
    const variants = ["logo", "logo-forest", "logo-reversed", "logo-white", "mark", "mark-white"];
    expect([...svgs].sort()).toEqual(variants.map((v) => `aarvion-${v}.svg`).sort());
  });

  // BrandMark (#62) sizes the logo by BRAND_LOGO_RATIO = 3.0; import it here once that lands.
  it.each(svgs.filter((f) => f.startsWith("aarvion-logo")))("%s is 3:1 within 1%", (file) => {
    const text = readFileSync(path.join(brand, file), "utf8");
    const [, w, h] = text.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/)!.map(Number);
    expect(Math.abs(w! / h! / 3.0 - 1)).toBeLessThan(0.01);
  });

  describe.each(svgs)("%s", (file) => {
    const text = readFileSync(path.join(brand, file), "utf8");

    it("parses as an SVG image", async () => {
      const meta = await sharp(Buffer.from(text)).metadata();
      expect(meta.format).toBe("svg");
      expect(meta.width).toBeGreaterThan(0);
    });

    it("has a viewBox, a title and the img role", () => {
      expect(text).toMatch(/^<svg [^>]*viewBox="0 0 [\d.]+ [\d.]+"/);
      expect(text).toContain('role="img"');
      expect(text).toContain("<title>Aarvion</title>");
    });

    it("is vector only, with no embedded raster", () => {
      expect(text).not.toMatch(/<image|data:image|base64/i);
    });

    it("uses only the documented logo colours", () => {
      const colours = [...text.matchAll(/#[0-9a-f]{3,8}\b/gi)].map((m) => m[0].toUpperCase());
      expect(colours.length).toBeGreaterThan(0);
      for (const c of colours) expect(LOGO_COLOURS).toContain(c);
      expect(text).not.toMatch(/\b(rgb|hsl)a?\(|fill="(?!#)|stroke=/);
    });

    it("stays small (under 8 KB)", () => {
      expect(Buffer.byteLength(text)).toBeLessThan(8192);
    });
  });
});

describe("logo PNGs and app icons", () => {
  const sizes: [string, number, number?][] = [
    ...["aarvion-logo", "aarvion-logo-reversed"].flatMap((n) =>
      [1024, 2048, 4096].map((w): [string, number] => [`public/brand/png/${n}-${w}.png`, w]),
    ),
    ["public/brand/icon-192.png", 192, 192],
    ["public/brand/icon-512-maskable.png", 512, 512],
    ["src/app/apple-icon.png", 180, 180],
    ["src/app/opengraph-image.png", 1200, 630],
  ];

  it.each(sizes)("%s is %i px wide", async (file, width, height) => {
    const meta = await sharp(path.join(root, file)).metadata();
    expect(meta.width).toBe(width);
    if (height) expect(meta.height).toBe(height);
    if (file.includes("/png/")) expect(meta.hasAlpha).toBe(true);
  });

  it("src/app/favicon.ico holds 16, 32 and 48 px images", () => {
    const ico = readFileSync(path.join(root, "src/app/favicon.ico"));
    expect([...ico.subarray(0, 4)]).toEqual([0, 0, 1, 0]);
    const n = ico.readUInt16LE(4);
    const widths = Array.from({ length: n }, (_, i) => ico[6 + 16 * i]).sort((a, b) => a! - b!);
    expect(widths).toEqual([16, 32, 48]);
  });

  it("src/app/icon.svg exists and is vector only", () => {
    const file = path.join(root, "src/app/icon.svg");
    expect(existsSync(file)).toBe(true);
    expect(readFileSync(file, "utf8")).not.toMatch(/<image|data:image/i);
  });
});
