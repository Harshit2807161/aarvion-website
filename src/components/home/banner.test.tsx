import { renderToString } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { findClaims } from "../../../tests/helpers/claims";

const catalogue = vi.hoisted(() => ({ slugs: [] as string[] }));
vi.mock("@/lib/catalogue/cached", () => ({
  getCachedProducts: vi.fn(async () => catalogue.slugs.map((slug) => ({ slug }))),
}));

import { HeroBanner } from "./banner";

const FULL = [
  "sacuwin-50",
  "sacuwin-100",
  "sacuwin-200",
  "hyloage",
  "sysnet-ultra",
  "caftop",
  "oloage-kt",
];

/** The server markup, parsed: what the browser paints before hydration. */
async function ssr() {
  const el = document.createElement("div");
  el.innerHTML = renderToString(await HeroBanner());
  return el;
}

const slides = (el: Element) => [...el.querySelectorAll(".slide")];
const ids = (el: Element) => slides(el).map((s) => s.className.match(/slide--(\w+)/)![1]);

beforeEach(() => void (catalogue.slugs = FULL));

describe("HeroBanner", () => {
  it("makes slide 1's image the LCP (eager, fetchpriority high, 1792 × 588) and the rest lazy", async () => {
    const el = await ssr();
    const imgs = [...el.querySelectorAll(".slide > picture > img")];
    expect(imgs).toHaveLength(4);
    expect(imgs[0]!.getAttribute("src")).toContain("sacuwin-1792.webp");
    expect(imgs[0]).toHaveAttribute("loading", "eager");
    expect(imgs[0]).toHaveAttribute("fetchpriority", "high");
    expect(imgs[0]).toHaveAttribute("width", "1792");
    expect(imgs[0]).toHaveAttribute("height", "588");
    expect(imgs[0]).toHaveAttribute("sizes", "(max-width: 719px) 86vw, min(1280px, 100vw - 80px)");
    for (const [i, img] of imgs.slice(1).entries()) {
      expect(img).toHaveAttribute("loading", "lazy");
      expect(img).not.toHaveAttribute("fetchpriority");
      // No src or srcset before load: the hook reveals them, so no request precedes the LCP.
      expect(img).not.toHaveAttribute("src");
      expect(img).not.toHaveAttribute("srcset");
      expect(img.getAttribute("data-src")).toContain(`${ids(el)[i + 1]}-1792.webp`);
      expect(img.getAttribute("data-srcset")).toContain(`${ids(el)[i + 1]}-1792.webp`);
    }
    expect(el.querySelector("link[rel=preload]")).toBeNull(); // [C24]
  });

  it("gives slides 2 to 4 a noscript picture with real sources, and slide 1 none", async () => {
    const el = await ssr();
    const groups = slides(el);
    expect(groups[0]!.querySelector("noscript")).toBeNull();
    groups.slice(1).forEach((g, i) => {
      const ns = g.querySelector("noscript");
      expect(ns, `slide ${i + 2} has a noscript fallback`).not.toBeNull();
      // happy-dom keeps noscript content as text, as a browser with JS on does.
      const html = ns!.textContent || ns!.innerHTML;
      expect(html).toContain(`${ids(el)[i + 1]}-1792.webp`);
      expect(html).toMatch(/<img[^>]* src="/);
      expect(html).toContain(`${ids(el)[i + 1]}-m.webp`);
    });
  });

  it("gives every picture the 840 × 472 phone crop as its (max-width: 719px) source", async () => {
    const el = await ssr();
    const sources = [...el.querySelectorAll(".slide > picture > source")];
    expect(sources).toHaveLength(4);
    sources.forEach((s, i) => {
      expect(s).toHaveAttribute("media", "(max-width: 719px)");
      expect(s).toHaveAttribute("width", "840");
      expect(s).toHaveAttribute("height", "472");
      expect(s).toHaveAttribute("sizes", "86vw");
      const set = s.getAttribute(i === 0 ? "srcset" : "data-srcset");
      expect(set).toContain(`${ids(el)[i]}-m.webp`);
      if (i > 0) expect(s).not.toHaveAttribute("srcset");
    });
  });

  it("server-renders slide groups 1 of 4 to 4 of 4, only slide 1 current and none inert", async () => {
    const el = await ssr();
    expect(ids(el)).toEqual(["sacuwin", "eye", "rx", "delivery"]);
    expect(
      slides(el).map((s) => [
        s.getAttribute("role"),
        s.getAttribute("aria-roledescription"),
        s.getAttribute("aria-label"),
      ]),
    ).toEqual([1, 2, 3, 4].map((n) => ["group", "slide", `${n} of 4`]));
    expect(slides(el).map((s) => s.classList.contains("is-current"))).toEqual([
      true,
      false,
      false,
      false,
    ]);
    expect(el.innerHTML).not.toMatch(/is-leaving|inert/);
    expect(slides(el).map((s) => s.querySelector("h2.slide-title")?.textContent)).toEqual([
      "Sacuwin 50, 100 and 200",
      "Eye drops, delivered to your door",
      "Upload your prescription",
      "Free delivery anywhere in India",
    ]);
  });

  it("leads with the prescription slide, which takes the LCP attributes, when Sacuwin is not live", async () => {
    catalogue.slugs = FULL.filter((s) => s !== "sacuwin-100");
    const el = await ssr();
    expect(ids(el)).toEqual(["rx", "delivery", "eye"]);
    const lead = el.querySelector("img")!;
    expect(lead.getAttribute("src")).toContain("rx-1792.webp");
    expect(lead).toHaveAttribute("fetchpriority", "high");
    expect(slides(el).map((s) => s.getAttribute("aria-label"))).toEqual([
      "1 of 3",
      "2 of 3",
      "3 of 3",
    ]);
    expect(el.querySelector(".hero-dot")).toHaveAttribute(
      "aria-label",
      "Slide 1: Upload your prescription",
    );
  });

  it("links each slide's forest button exactly, arrows after the label and upload before", async () => {
    const el = await ssr();
    const links = [...el.querySelectorAll(".slide-copy > a")];
    expect(links.map((a) => [a.textContent, a.getAttribute("href"), a.className])).toEqual([
      ["Shop Sacuwin", "#heart-care", "btn btn-forest"],
      ["Shop eye care", "#eye-care", "btn btn-forest"],
      ["Upload prescription", "/account/prescriptions", "btn btn-forest"],
      ["Browse all medicines", "#medicines", "btn btn-forest"],
    ]);
    expect(
      links.map((a) =>
        a.firstElementChild!.tagName.toLowerCase() === "svg" ? "icon first" : "label first",
      ),
    ).toEqual(["label first", "label first", "icon first", "label first"]);
    expect(el.textContent).toContain("Cash on delivery available.");
    expect(findClaims(el.textContent!)).toEqual([]);
  });
});
