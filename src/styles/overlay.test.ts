import { readFileSync } from "node:fs";
import path from "node:path";
import tailwindcss from "@tailwindcss/postcss";
import postcss, { type AtRule, type Document, type Root, type Rule } from "postcss";
import { beforeAll, describe, expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "../..");
const globalsPath = path.join(root, "src/app/globals.css");

describe("overlay styles in the built CSS", () => {
  let built: Root;
  beforeAll(async () => {
    const result = await postcss([tailwindcss()]).process(readFileSync(globalsPath, "utf8"), {
      from: globalsPath,
    });
    built = result.root;
  }, 60_000);

  /** Every rule with exactly this selector, optionally only inside an at-rule whose params match. */
  const rules = (selector: string, within?: { name: string; params: RegExp }): Rule[] => {
    const found: Rule[] = [];
    built.walkRules((rule) => {
      if (rule.selector !== selector) return;
      if (within) {
        let parent: Rule["parent"] | Document | undefined = rule.parent;
        while (parent && !(parent.type === "atrule" && (parent as AtRule).name === within.name))
          parent = parent.parent;
        if (!parent || !within.params.test((parent as AtRule).params)) return;
      }
      found.push(rule);
    });
    return found;
  };
  const text = (rs: Rule[]) => rs.map((r) => r.toString()).join("\n");

  it("[C16] imports overlay.css: the panel is fixed and the phone block sizes it as a bottom sheet", () => {
    expect(text(rules(".sheet-panel"))).toContain("position: fixed");
    const phone = { name: "media", params: /max-width:\s*639px/ };
    expect(text(rules(".sheet-grip", phone))).toContain("display: block");
    expect(text(rules(".sheet--dialog", phone))).toContain("border-radius: 24px 24px 0 0");
    expect(text(rules('.sheet-panel.is-dragging[data-state="open"]', phone))).toContain(
      "animation: none",
    );
  });

  it("paints the scrim with an Aarvion token, since --color-black does not exist", () => {
    // shadcn's stock bg-black/50 compiles to nothing once the palette is reset.
    const scrim = text(rules(".sheet-scrim"));
    expect(scrim).toContain("color-mix(in srgb, var(--color-forest-950) 50%, transparent)");
    expect(scrim).toContain("position: fixed");
  });

  it("animates the open and closed states by data-state", () => {
    expect(text(rules('.sheet--side[data-state="closed"]'))).toContain("forwards");
    expect(text(rules('.sheet--dialog[data-state="open"]'))).toContain("sheet-scale-in 260ms");
  });

  it("reduces motion to opacity over 200ms", () => {
    const reduced = { name: "media", params: /prefers-reduced-motion:\s*reduce/ };
    const open = text(rules('.sheet-panel[data-state="open"]', reduced));
    expect(open).toContain("sheet-fade-in 200ms");
    expect(open).not.toMatch(/translate|scale/);
  });

  it("maps the shadcn colour roles onto the :root roles", () => {
    const css = built.toString();
    expect(css).toMatch(/--color-background:\s*var\(--background\)/);
    expect(css).toMatch(/--color-ring:\s*var\(--ring\)/);
  });
});
