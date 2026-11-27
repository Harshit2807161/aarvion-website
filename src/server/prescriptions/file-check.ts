import { createHash } from "node:crypto";
import sharp from "sharp";

/**
 * Prescription file validation. The bytes decide the type (never a name or a declared type).
 * Images are decoded and re-encoded to WebP with every piece of metadata dropped, which also
 * destroys anything appended after the image data; PDFs are not re-rendered, they are scanned
 * byte-wise and stored unchanged. Pure apart from sharp: no I/O, no clock, no logging, and the
 * result carries error names only (never bytes or file names).
 */
export const RX_MAX_BYTES = 8_388_608;
export const RX_IMAGE_MAX_SIDE = 3000;
export const RX_IMAGE_MIN_SIDE = 400;
export const RX_MAX_INPUT_PIXELS = 50_000_000;
export const RX_WEBP_QUALITY = 85;
export const RX_PDF_MAX_PAGES = 20;

export type RxFileError =
  | "empty"
  | "too_large"
  | "unsupported_type"
  | "corrupt"
  | "too_small"
  | "animated"
  | "too_many_pages"
  | "encrypted"
  | "active_content";

export type CheckedRxFile = {
  body: Uint8Array;
  contentType: "image/webp" | "application/pdf";
  ext: "webp" | "pdf";
  kind: "image" | "pdf";
  pages: number;
  width: number | null;
  height: number | null;
  sha256: string;
};

const startsWith = (b: Uint8Array, sig: readonly number[], at = 0) =>
  b.length >= at + sig.length && sig.every((v, i) => b[at + i] === v);
const ascii = (s: string) => [...s].map((c) => c.charCodeAt(0));

/** The type from the first bytes: JPEG, PNG, WebP or a PDF 1.0 to 2.0 header; else null. */
export function sniffType(bytes: Uint8Array): "jpeg" | "png" | "webp" | "pdf" | null {
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "jpeg";
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "png";
  if (startsWith(bytes, ascii("RIFF")) && startsWith(bytes, ascii("WEBP"), 8)) return "webp";
  if (startsWith(bytes, ascii("%PDF-"))) {
    const v = String.fromCharCode(...bytes.subarray(5, 8));
    if (/^1\.[0-7]$/.test(v) || v === "2.0") return "pdf";
  }
  return null;
}

/** Names that make a PDF refused, matched after `#xx` escapes are decoded. */
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
];
/** A name counts only when a delimiter follows it, so `/JSONData` is not `/JS`. */
const nameRe = (name: string) => new RegExp(String.raw`/${name}(?=[\s/\[<(>]|$)`);
const ACTIVE_RES = ACTIVE_NAMES.map(nameRe);
const ENCRYPT_RE = nameRe("Encrypt");
const PAGE_RE = /\/Type\s*\/Page(?![A-Za-z0-9])/g;

/**
 * A byte-wise PDF scan (the PDF is stored as it came, so this is the whole defence): `%%EOF`
 * within the last 1024 bytes, no `/Encrypt`, none of ACTIVE_NAMES, 1 to 20 `/Type /Page` objects.
 * Active content inside compressed object streams is not seen; that is listed for phase H.
 */
export function scanPdf(
  bytes: Uint8Array,
):
  | { ok: true; pages: number }
  | { ok: false; error: "corrupt" | "too_many_pages" | "encrypted" | "active_content" } {
  const latin1 = Buffer.from(bytes).toString("latin1");
  if (!latin1.slice(-1024).includes("%%EOF")) return { ok: false, error: "corrupt" };
  const decoded = latin1.replace(/#([0-9A-Fa-f]{2})/g, (_m, h: string) =>
    String.fromCharCode(Number.parseInt(h, 16)),
  );
  if (ENCRYPT_RE.test(decoded)) return { ok: false, error: "encrypted" };
  if (ACTIVE_RES.some((re) => re.test(decoded))) return { ok: false, error: "active_content" };
  const pages = decoded.match(PAGE_RE)?.length ?? 0;
  if (pages === 0) return { ok: false, error: "corrupt" };
  if (pages > RX_PDF_MAX_PAGES) return { ok: false, error: "too_many_pages" };
  return { ok: true, pages };
}

const sha256 = (b: Uint8Array) => createHash("sha256").update(b).digest("hex");

async function checkImage(
  bytes: Uint8Array,
): Promise<{ ok: true; file: CheckedRxFile } | { ok: false; error: RxFileError }> {
  try {
    const options = { limitInputPixels: RX_MAX_INPUT_PIXELS, failOn: "error" } as const;
    // `pages: 1` would make the frame count read as 1, so ask for it without that option.
    const meta = await sharp(Buffer.from(bytes), options).metadata();
    if ((meta.pages ?? 1) > 1) return { ok: false, error: "animated" };
    const input = sharp(Buffer.from(bytes), { ...options, pages: 1 });
    // No withMetadata(): sharp then drops EXIF, ICC and XMP; rotate() applies the orientation first.
    const { data, info } = await input
      .rotate()
      .resize(RX_IMAGE_MAX_SIDE, RX_IMAGE_MAX_SIDE, { fit: "inside", withoutEnlargement: true })
      .toColorspace("srgb")
      .webp({ quality: RX_WEBP_QUALITY })
      .toBuffer({ resolveWithObject: true });
    if (Math.min(info.width, info.height) < RX_IMAGE_MIN_SIDE) {
      return { ok: false, error: "too_small" };
    }
    return {
      ok: true,
      file: {
        body: data,
        contentType: "image/webp",
        ext: "webp",
        kind: "image",
        pages: 1,
        width: info.width,
        height: info.height,
        sha256: sha256(data),
      },
    };
  } catch {
    return { ok: false, error: "corrupt" };
  }
}

/**
 * Validate one uploaded file and return what to store: the re-encoded WebP for an image, the
 * unchanged bytes for a PDF. Order: size, type by magic bytes, then the image or PDF checks.
 */
export async function checkRxFile(
  bytes: Uint8Array,
): Promise<{ ok: true; file: CheckedRxFile } | { ok: false; error: RxFileError }> {
  if (bytes.length === 0) return { ok: false, error: "empty" };
  if (bytes.length > RX_MAX_BYTES) return { ok: false, error: "too_large" };
  const kind = sniffType(bytes);
  if (kind === null) return { ok: false, error: "unsupported_type" };
  if (kind !== "pdf") return checkImage(bytes);
  const scan = scanPdf(bytes);
  if (!scan.ok) return scan;
  return {
    ok: true,
    file: {
      body: bytes,
      contentType: "application/pdf",
      ext: "pdf",
      kind: "pdf",
      pages: scan.pages,
      width: null,
      height: null,
      sha256: sha256(bytes),
    },
  };
}
