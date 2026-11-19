import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

type Deps = Record<string, string>;
const pkg = JSON.parse(
  readFileSync(path.resolve(import.meta.dirname, "../package.json"), "utf8"),
) as {
  dependencies?: Deps;
  devDependencies?: Deps;
  optionalDependencies?: Deps;
  peerDependencies?: Deps;
  pnpm?: { overrides?: Deps };
};

// An override can pull a banned package in just as a dependency can; overrides may be
// keyed "pkg@range", so only the name part counts.
const overrideNames = Object.keys(pkg.pnpm?.overrides ?? {}).map((k) =>
  k.replace(/^(@?[^@]+)@.*$/, "$1"),
);
const keys = [
  ...Object.keys({
    ...pkg.dependencies,
    ...pkg.devDependencies,
    ...pkg.optionalDependencies,
    ...pkg.peerDependencies,
  }),
  ...overrideNames,
];

const FORBIDDEN = [
  "framer-motion",
  "motion",
  "swiper",
  "embla-carousel",
  "embla-carousel-react",
  "gsap",
  "lenis",
  "locomotive-scroll",
  "sonner",
  "lucide-react",
  "tw-animate-css",
  "tailwindcss-animate",
];

const RADIX_ALLOWED = ["radix-ui", "@radix-ui/react-dialog", "@radix-ui/react-slot"];

describe("storefront dependency policy", () => {
  it.each(FORBIDDEN.map((name) => [name]))("never depends on %s", (name) => {
    expect(keys).not.toContain(name);
  });

  it("limits Radix to the dialog and slot primitives", () => {
    const radix = keys.filter((k) => k === "radix-ui" || k.startsWith("@radix-ui/"));
    expect(radix.filter((k) => !RADIX_ALLOWED.includes(k))).toEqual([]);
  });
});
