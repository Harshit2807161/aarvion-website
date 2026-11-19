import { execFileSync } from "node:child_process";
import { closeSync, openSync, readSync } from "node:fs";
import { fileURLToPath } from "node:url";

export const MAX_CHANGED_LINES = 400;

export const DEFAULT_EXCLUDES = [
  "pnpm-lock.yaml",
  "data/**",
  "**/*.webp",
  "**/*.png",
  "**/*.svg",
  "docs/superpowers/**",
  "docs/decisions/**",
  "assets/fonts/*.txt",
];

const GENERATED_MARKER = "@generated shadcn";

function globToRegExp(glob: string): RegExp {
  let re = "";
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i]!;
    if (c === "*") {
      if (glob[i + 1] === "*") {
        i++;
        if (glob[i + 1] === "/") {
          i++;
          re += "(?:.*/)?";
        } else {
          re += ".*";
        }
      } else {
        re += "[^/]*";
      }
    } else if (c === "?") {
      re += "[^/]";
    } else {
      re += c.replace(/[.+^${}()|[\]\\]/g, "\\$&");
    }
  }
  return new RegExp(`^${re}$`);
}

/**
 * Sum added + deleted lines from `git diff --numstat` output.
 * Skips paths matching `exclude` globs, binary rows (`-\t-\tpath`), and any
 * path for which `isGenerated` returns true.
 */
export function countChangedLines(
  diffNumstat: string,
  exclude: string[],
  isGenerated: (path: string) => boolean = () => false,
): number {
  const matchers = exclude.map(globToRegExp);
  let total = 0;
  for (const line of diffNumstat.split("\n")) {
    if (!line.trim()) continue;
    const [added, deleted, ...rest] = line.split("\t");
    const path = rest.join("\t");
    if (!path || added === "-" || deleted === "-") continue;
    if (matchers.some((m) => m.test(path))) continue;
    if (isGenerated(path)) continue;
    total += Number(added) + Number(deleted);
  }
  return total;
}

function firstLineHasMarker(path: string): boolean {
  let fd: number | undefined;
  try {
    fd = openSync(path, "r");
    const buf = Buffer.alloc(512);
    const n = readSync(fd, buf, 0, buf.length, 0);
    return buf.toString("utf8", 0, n).split("\n")[0]!.includes(GENERATED_MARKER);
  } catch {
    return false; // deleted or unreadable: count it
  } finally {
    if (fd !== undefined) closeSync(fd);
  }
}

function main(): number {
  const base = process.argv[2];
  if (!base) {
    console.error("usage: pr-size <base-ref>");
    return 2;
  }
  const numstat = execFileSync(
    "git",
    ["diff", "--numstat", "--no-renames", `${base}...HEAD`],
    { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
  );
  const count = countChangedLines(numstat, DEFAULT_EXCLUDES, firstLineHasMarker);
  console.log(`Changed lines: ${count} (limit ${MAX_CHANGED_LINES})`);
  if (count > MAX_CHANGED_LINES) {
    console.error(
      `PR is over ${MAX_CHANGED_LINES} changed lines. Please split it into smaller PRs.`,
    );
    return 1;
  }
  return 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exit(main());
}
