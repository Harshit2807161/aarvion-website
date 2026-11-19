import { readFileSync } from "node:fs";
import path from "node:path";
import postcss, { type AtRule, type Rule } from "postcss";
import { describe, expect, it } from "vitest";
import { AUTOPLAY_MS } from "@/components/home/carousel";

const root = postcss.parse(readFileSync(path.resolve(import.meta.dirname, "banner.css"), "utf8"));

/** The declarations of the rule whose selector list includes `selector`, outside or inside `media`. */
function decls(selector: string, media?: RegExp): Record<string, string> {
  const out: Record<string, string> = {};
  root.walkRules((rule: Rule) => {
    if (!rule.selectors.includes(selector)) return;
    const parent = rule.parent as AtRule;
    const inMedia = parent.type === "atrule" && parent.name === "media";
    if (media ? !(inMedia && media.test(parent.params)) : inMedia) return;
    rule.walkDecls((d) => void (out[d.prop] = d.value));
  });
  return out;
}

const fill = '.hero-dot[aria-current="true"] .dot-fill::after';

describe("banner.css", () => {
  it("runs the autoplay clock as the current dot's fill, AUTOPLAY_MS long", () => {
    expect(decls(`.hero.is-auto ${fill}`).animation).toBe(
      `dot-run ${AUTOPLAY_MS / 1000}s linear both`,
    );
  });

  it("pauses the fill under a hold and under the user's pause", () => {
    expect(decls(`.hero.is-auto.is-held ${fill}`)["animation-play-state"]).toBe("paused");
    expect(decls(`.hero.is-auto.is-stopped ${fill}`)["animation-play-state"]).toBe("paused");
  });

  it("hides the controls until load and the pause control under reduced motion", () => {
    expect(decls(".hero:not(.is-ready) .hero-ctl").visibility).toBe("hidden");
    expect(decls(".hero.no-auto .hero-play").display).toBe("none");
  });

  it("is a 1280 × 420 strip on desktop whose 300px floor never widens it", () => {
    expect(decls(".hero-track")).toMatchObject({
      width: "100%",
      "aspect-ratio": "1280 / 420",
      "min-height": "300px",
      "border-radius": "var(--radius-strip)",
    });
  });

  it("is a scroll-snap row of 86% cards on phones", () => {
    const phone = /max-width:\s*719px/;
    expect(decls(".hero-track", phone)).toMatchObject({
      "scroll-snap-type": "x mandatory",
      "min-height": "0",
    });
    expect(decls(".hero .slide", phone)).toMatchObject({
      flex: "0 0 86%",
      "scroll-snap-align": "start",
    });
    expect(decls(".slide-img", phone)["aspect-ratio"]).toBe("16 / 9");
  });
});
