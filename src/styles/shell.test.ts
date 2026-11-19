import { readFileSync } from "node:fs";
import path from "node:path";
import postcss, { type AtRule, type Rule } from "postcss";
import { describe, expect, it } from "vitest";

const css = readFileSync(path.resolve(import.meta.dirname, "shell.css"), "utf8");
const root = postcss.parse(css);

/** The declarations of `selector` inside the media block whose params match, or at top level. */
function decls(selector: string, media?: RegExp): Record<string, string> {
  const out: Record<string, string> = {};
  root.walkRules(selector, (rule: Rule) => {
    const parent = rule.parent as AtRule | undefined;
    const inMedia = parent?.type === "atrule" && parent.name === "media";
    if (media ? !(inMedia && media.test(parent.params)) : inMedia) return;
    rule.walkDecls((d) => void (out[d.prop] = d.value));
  });
  return out;
}

describe("shell.css", () => {
  it("is the desktop shell: 96px band foot, a -56px overlap with 24px corners", () => {
    expect(decls(".band").padding).toBe("40px 0 96px");
    expect(decls(".work")["margin"]).toBe("-56px auto 0");
    expect(decls(".work")["border-radius"]).toBe("24px 24px 0 0");
    expect(decls(".work-in").padding).toBe("44px 0 96px");
  });

  it("tightens the shell on phones (flows.css 827-832)", () => {
    const phone = /max-width:\s*720px/;
    expect(decls(".band", phone).padding).toBe("28px 0 64px");
    expect(decls(".band-title", phone)["font-size"]).toBe("clamp(1.75rem, 1.2rem + 2.4vw, 2.125rem)");
    expect(decls(".band-sub", phone)["font-size"]).toBe("0.9375rem");
    expect(decls(".work", phone)["margin-top"]).toBe("-32px");
    expect(decls(".work", phone)["border-radius"]).toBe("22px 22px 0 0");
    expect(decls(".work-in", phone).padding).toBe("28px 0 72px");
  });
});
