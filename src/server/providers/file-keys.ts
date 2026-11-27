/**
 * Shared by every FileStore: the key rule and the size cap. Keys are built by our own code
 * (`rx/<userIdHex>/<rxIdHex>.webp`, `rx-staging/<userIdHex>/<stagingId>`), never from user input,
 * but every provider still checks them so a bug can never write outside its folder or bucket.
 */
const SAFE_KEY = /^[a-z-]+(\/[A-Za-z0-9_-]+)+(\.(webp|pdf))?$/;

/** Throws unless the key is a lowercase prefix, then segments of [A-Za-z0-9_-], then an optional .webp or .pdf. */
export function assertSafeKey(key: string): void {
  if (!SAFE_KEY.test(key)) throw new Error("unsafe file key");
}

/**
 * The only content types a store keeps: the re-encoded image, the PDF, and raw staging bytes.
 * Read handlers set their own Content-Type from the prescription record, never the stored one.
 */
const STORED_TYPES = new Set(["image/webp", "application/pdf", "application/octet-stream"]);

export function assertStoredType(contentType: string): void {
  if (!STORED_TYPES.has(contentType)) throw new Error("unsupported stored content type");
}

/** A read with no `maxBytes` is still bounded: 8 MiB, the prescription file cap (RX_MAX_BYTES, pinned by test). */
export const DEFAULT_MAX_READ_BYTES = 8_388_608;

/**
 * A put to a key that already exists. Keys are built from fresh ids, so this is a bug or a retry,
 * and silently replacing the bytes behind a reviewed prescription would be worse than failing.
 * Note for callers (R4, R5): the Blob SDK retries a put internally, so a put whose first attempt
 * landed but whose response was lost comes back as FileExistsError. Treat it as success only after
 * reading the key back and checking its SHA-256, or retry with a new id.
 */
export class FileExistsError extends Error {
  constructor() {
    super("a file already exists at this key");
    this.name = "FileExistsError";
  }
}

export class FileTooLargeError extends Error {
  constructor() {
    super("file is larger than the allowed size");
    this.name = "FileTooLargeError";
  }
}

/** Reads a stream into one array, cancelling it and throwing FileTooLargeError once past `maxBytes`. */
export async function readStreamCapped(
  stream: ReadableStream<Uint8Array>,
  maxBytes = DEFAULT_MAX_READ_BYTES,
): Promise<Uint8Array> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new FileTooLargeError();
    }
    chunks.push(value);
  }
  return new Uint8Array(Buffer.concat(chunks));
}

export function assertWithinCap(byteLength: number, maxBytes = DEFAULT_MAX_READ_BYTES): void {
  if (byteLength > maxBytes) throw new FileTooLargeError();
}
