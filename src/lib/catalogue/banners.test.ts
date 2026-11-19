import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ROUTES } from "@/config/routes";
import { SITE_CONFIG } from "@/config/site";
import { findClaims } from "../../../tests/helpers/claims";
import { BANNER_SLIDES, bannerSlides } from "./banners";

const root = path.resolve(import.meta.dirname, "../../..");
const seed = JSON.parse(readFileSync(path.join(root, "data/products.json"), "utf8")) as {
  products: { slug: string; imageSource: string }[];
};
const ALL = seed.products.map(({ slug }) => ({ slug }));
const without = (slug: string) => ALL.filter((p) => p.slug !== slug);
const ids = (products: { slug: string }[]) => bannerSlides(products).map((s) => s.id);

describe("bannerSlides, the banner fallback", () => {
  it("shows all four for the full catalogue", () => {
    expect(ids(ALL)).toEqual(["sacuwin", "eye", "rx", "delivery"]);
  });

  it("drops Sacuwin when one pack is not live; prescription leads and eye moves last", () => {
    expect(ids(without("sacuwin-100"))).toEqual(["rx", "delivery", "eye"]);
  });

  it("drops the eye slide when one of its packs is not live", () => {
    expect(ids(without("caftop"))).toEqual(["sacuwin", "rx", "delivery"]);
  });

  it("always keeps prescription and delivery", () => {
    expect(ids([])).toEqual(["rx", "delivery"]);
  });

  it("never leads with a pack that is not Aarvion-printed", () => {
    const printer = new Map(seed.products.map((p) => [p.slug, p.imageSource]));
    for (const products of [ALL, ...ALL.map((p) => without(p.slug))]) {
      const lead = bannerSlides(products)[0]!;
      expect(lead.needs.filter((slug) => printer.get(slug) !== "aarvion")).toEqual([]);
    }
  });
});

describe("BANNER_SLIDES", () => {
  it("links each slide's button as the brief says", () => {
    expect(BANNER_SLIDES.map((s) => [s.id, s.cta.label, s.cta.href, s.cta.icon])).toEqual([
      ["sacuwin", "Shop Sacuwin", "#heart-care", "arrow"],
      ["eye", "Shop eye care", "#eye-care", "arrow"],
      ["rx", "Upload prescription", ROUTES.uploadRx, "upload"],
      ["delivery", "Browse all medicines", "#medicines", "arrow"],
    ]);
  });

  it("points at the shipped 1792 × 588 master and 840 × 472 phone crop of each scene", () => {
    for (const s of BANNER_SLIDES) {
      expect(s.desktop).toEqual({ src: `/banners/${s.id}-1792.webp`, width: 1792, height: 588 });
      expect(s.phone).toEqual({ src: `/banners/${s.id}-m.webp`, width: 840, height: 472 });
      for (const src of [s.desktop.src, s.phone.src])
        expect(existsSync(path.join(root, "public", src))).toBe(true);
    }
  });

  it("never leads a heading or line with the ₹20", () => {
    for (const s of BANNER_SLIDES) {
      expect(s.title).not.toMatch(/^₹?20\b|₹20 below/);
      expect(s.line).not.toMatch(/^₹?20\b|₹20 below/);
    }
  });

  it("makes no invented claims in any copy, alt or dot name", () => {
    const copy = BANNER_SLIDES.flatMap((s) => [s.title, s.line, s.cta.label, s.alt, s.dot]);
    expect(findClaims(copy.join("\n"))).toEqual([]);
  });

  it("claims online payment only while online payments are on", () => {
    const line = (onlinePayments: boolean) =>
      bannerSlides(ALL, { onlinePayments }).find((s) => s.id === "delivery")!.line;
    expect(line(false)).toBe("Cash on delivery available.");
    expect(line(true)).toBe("Pay online or cash on delivery.");
    expect(BANNER_SLIDES.find((s) => s.id === "delivery")!.line).toBe(
      line(SITE_CONFIG.onlinePayments),
    );
  });
});
