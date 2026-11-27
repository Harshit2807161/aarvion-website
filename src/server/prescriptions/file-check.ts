import { createHash } from "node:crypto";
import sharp from "sharp";

/**
 * Prescription file validation. The bytes decide the type (never a name or a declared type).
 * Images are decoded and re-encoded to WebP with every piece of metadata dropped, which also
 * destroys anything appended after the image data. Pure apart from sharp: no I/O, no clock, no logging, and the
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
  // The PDF scan follows in the next PR (R2 part B); until then a PDF is refused.
  if (kind === "pdf") return { ok: false, error: "unsupported_type" };
  return checkImage(bytes);
}
