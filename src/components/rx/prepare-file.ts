/**
 * Readies a chosen prescription file for upload, in the browser. A convenience only: the server
 * checks every file again (type, size, decode, pages) and its answer wins. Large or oversized
 * photos are shrunk here so a phone on a slow network sends about 1 MB, not 8. Nothing here logs:
 * file names and contents are personal data.
 */
import { fileSize, RX_COPY } from "./rx-copy";

/** Client copy of the server's RX_MAX_BYTES (8 MiB), pinned by prepare-file.test.ts. */
export const RX_UPLOAD_MAX_BYTES = 8_388_608;
/** A photo over 1.5 MiB, or longer than this on its longest side, is re-encoded. */
export const RX_REENCODE_OVER_BYTES = 1_572_864;
export const RX_UPLOAD_MAX_SIDE = 2560;
/** Client copy of the server's RX_IMAGE_MIN_SIDE: a resize never takes the short side below it. */
export const RX_UPLOAD_MIN_SIDE = 400;
/**
 * The server fits a photo inside 3000 px, then needs 400 px on the short side, so anything longer
 * than 7.5 : 1 is always refused as too small (RX_IMAGE_MAX_SIDE / RX_IMAGE_MIN_SIDE, pinned by
 * test). It is refused here at once instead of after a slow upload.
 */
export const RX_UPLOAD_MAX_ASPECT = 7.5;
const JPEG_QUALITY = 0.85;

/** What the server stores as is. HEIC and HEIF are read here (where the browser can) but never sent. */
const SENDABLE = new Map([
  ["image/jpeg", "image"],
  ["image/png", "image"],
  ["image/webp", "image"],
  ["application/pdf", "pdf"],
] as const);
const READABLE = new Set(["image/heic", "image/heif"]);
const BY_EXT: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  heic: "image/heic",
  heif: "image/heif",
  pdf: "application/pdf",
};

export type PreparedRx =
  { ok: true; blob: Blob; kind: "image" | "pdf" } | { ok: false; message: string };

/** The file's type by MIME, else by extension (some pickers send an empty or generic type). */
function typeOf(file: File): string | null {
  if (SENDABLE.has(file.type as never) || READABLE.has(file.type)) return file.type;
  const ext = /\.([a-z0-9]+)$/i.exec(file.name)?.[1]?.toLowerCase();
  return (ext && BY_EXT[ext]) || null;
}

/** The same bytes labelled with `type`, so the upload carries a type the server accepts. */
const labelled = (file: File, type: string): Blob =>
  file.type === type ? file : new Blob([file], { type });

function sized(blob: Blob, kind: "image" | "pdf", name: string): PreparedRx {
  if (blob.size > RX_UPLOAD_MAX_BYTES) {
    return { ok: false, message: RX_COPY.tooLarge(name, fileSize(blob.size)) };
  }
  return { ok: true, blob, kind };
}

async function decode(file: File): Promise<ImageBitmap | null> {
  if (typeof createImageBitmap !== "function") return null;
  try {
    return await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    return null;
  }
}

/**
 * Draws the photo at most RX_UPLOAD_MAX_SIDE long on white (no black behind a transparent PNG),
 * but never with its short side under RX_UPLOAD_MIN_SIDE: a long, narrow page (1000 x 8000)
 * keeps 400 px across rather than becoming a 320 px strip the server refuses as too small.
 */
function reencode(bitmap: ImageBitmap): Promise<Blob | null> {
  const fit = RX_UPLOAD_MAX_SIDE / Math.max(bitmap.width, bitmap.height);
  const floor = RX_UPLOAD_MIN_SIDE / Math.min(bitmap.width, bitmap.height);
  const scale = Math.min(1, Math.max(fit, floor));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) return Promise.resolve(null);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY));
}

export async function prepareRxFile(file: File): Promise<PreparedRx> {
  const type = typeOf(file);
  if (!type) return { ok: false, message: RX_COPY.unsupported(file.name) };
  const sendable = SENDABLE.has(type as never);
  if (type === "application/pdf") return sized(labelled(file, type), "pdf", file.name);

  const bitmap = await decode(file);
  if (!bitmap) {
    // Not readable here (an old browser, a HEIC elsewhere than Safari): the server decides.
    return sendable
      ? sized(labelled(file, type), "image", file.name)
      : { ok: false, message: RX_COPY.unsupported(file.name) };
  }
  try {
    const long = Math.max(bitmap.width, bitmap.height);
    const short = Math.min(bitmap.width, bitmap.height);
    if (long > short * RX_UPLOAD_MAX_ASPECT) return { ok: false, message: RX_COPY.tooSmall };
    const small =
      file.size <= RX_REENCODE_OVER_BYTES &&
      Math.max(bitmap.width, bitmap.height) <= RX_UPLOAD_MAX_SIDE;
    if (small && sendable) return sized(labelled(file, type), "image", file.name);
    const jpeg = await reencode(bitmap);
    if (jpeg) return sized(jpeg, "image", file.name);
    return sendable
      ? sized(labelled(file, type), "image", file.name)
      : { ok: false, message: RX_COPY.unsupported(file.name) };
  } finally {
    bitmap.close();
  }
}
