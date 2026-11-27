export type PdfScan =
  | { ok: true; pages: number }
  | { ok: false; error: "corrupt" | "too_many_pages" | "encrypted" | "active_content" };

/** The most pages a prescription PDF may have. */
export const PDF_MAX_PAGES = 20;

/** A limit that keeps the scan linear on hostile input: page-tree names examined. */
const MAX_PAGES_NODES = 1000;

/**
 * Names that make a PDF refused, matched after `#xx` escapes are decoded. `/URI` is allowed.
 * `/GoToR` and `/GoToE` are refused because a remote path can make a viewer leak an NTLM hash.
 */
const ACTIVE_NAMES = [
  "JavaScript",
  "JS",
  "Launch",
  "EmbeddedFile",
  "EmbeddedFiles",
  "RichMedia",
  "XFA",
  "SubmitForm",
  "ImportData",
  "GoToR",
  "GoToE",
];

// PDF whitespace is NUL, TAB, LF, FF, CR and SP; the delimiters are ( ) < > [ ] { } / and %. A
// name ends at either, so a name continues over any other byte: `END` fails closed, which means
// `/JS%c` and `/JS\0` still match `/JS` while `/JSONData` does not.
const WS = String.raw`\x00\t\n\f\r `;
const END = String.raw`(?![^${WS}()<>\[\]{}/%])`;
/** Whitespace and comments between two tokens. */
const GAP = String.raw`(?:[${WS}]|%[^\r\n]*[\r\n])*`;
const nameRe = (name: string, flags = "") => new RegExp(String.raw`/${name}${END}`, flags);
const ACTIVE_RES = ACTIVE_NAMES.map((n) => nameRe(n));
const ENCRYPT_RE = nameRe("Encrypt");
// Pages are counted by the name alone, not `/Type` + `/Page`: a comment or NUL between them cannot
// hide one, and no pattern has to skip comments (which would be quadratic on hostile input).
const PAGE_RE = nameRe("Page", "g");
const PAGES_RE = nameRe("Pages", "g");
const COUNT_RE = new RegExp(String.raw`/Count${GAP}(-?\d+)`, "g");
const hexVal = (c: number) =>
  c >= 48 && c <= 57 ? c - 48 : c >= 65 && c <= 70 ? c - 55 : c >= 97 && c <= 102 ? c - 87 : -1;

/** Decode every `#xx` escape (a byte loop: a regex callback takes seconds on 8 MB of `#41`). */
function unescapeNames(t: string): string {
  const b = Buffer.from(t, "latin1");
  let n = 0;
  for (let i = 0; i < b.length; i++, n++) {
    const hi = b[i] === 0x23 ? hexVal(b[i + 1]!) : -1;
    const lo = hi >= 0 ? hexVal(b[i + 2]!) : -1;
    if (lo >= 0) {
      b[n] = hi * 16 + lo;
      i += 2;
    } else b[n] = b[i]!;
  }
  return b.toString("latin1", 0, n);
}

/** The `<< ... >>` around `at`, bounded; a fixed window when it cannot be found. */
function enclosingDict(t: string, at: number): string {
  const LIMIT = 65_536;
  let depth = 0;
  for (let i = at; i > 0 && at - i < LIMIT; i--) {
    if (t[i] === ">" && t[i - 1] === ">") {
      depth++;
      i--;
    } else if (t[i] === "<" && t[i - 1] === "<") {
      if (depth === 0) {
        let d = 1;
        for (let j = i + 1; j < t.length - 1 && j - i < LIMIT; j++) {
          const two = t[j]! + t[j + 1]!;
          if (two === "<<") {
            d++;
            j++;
          } else if (two === ">>") {
            if (--d === 0) return t.slice(i - 1, j + 2);
            j++;
          }
        }
        break;
      }
      depth--;
      i--;
    }
  }
  return t.slice(Math.max(0, at - 512), at + 512);
}

/**
 * A byte-wise PDF scan (a PDF is stored as it came, so this is the whole defence): `%%EOF` within
 * the last 1024 bytes, no `/Encrypt`, none of ACTIVE_NAMES, and 1 to 20 pages, counted as the
 * larger of the `/Page` names and the `/Count` of any page tree. Objects inside
 * compressed object streams are not seen until the next part (they would be refused or missed).
 * Left for phase H: incremental-save copies counted twice, and PDF metadata, which is kept.
 */
export function scanPdf(bytes: Uint8Array): PdfScan {
  const raw = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength).toString("latin1");
  if (!raw.slice(-1024).includes("%%EOF")) return { ok: false, error: "corrupt" };
  const names = unescapeNames(raw);
  if (ENCRYPT_RE.test(names)) return { ok: false, error: "encrypted" };
  const text = names;
  if (ACTIVE_RES.some((re) => re.test(text))) return { ok: false, error: "active_content" };
  let pages = text.match(PAGE_RE)?.length ?? 0;
  const trees = [...text.matchAll(PAGES_RE)];
  if (trees.length > MAX_PAGES_NODES) return { ok: false, error: "too_many_pages" };
  for (const m of trees) {
    for (const c of enclosingDict(text, m.index).matchAll(COUNT_RE)) {
      pages = Math.max(pages, Number(c[1]));
    }
  }
  if (pages < 1) return { ok: false, error: "corrupt" };
  if (pages > PDF_MAX_PAGES) return { ok: false, error: "too_many_pages" };
  return { ok: true, pages };
}
