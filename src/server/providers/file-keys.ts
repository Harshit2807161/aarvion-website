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

export class FileTooLargeError extends Error {
  constructor() {
    super("file is larger than the allowed size");
    this.name = "FileTooLargeError";
  }
}

/** Reads a stream into one array, cancelling it and throwing FileTooLargeError once past `maxBytes`. */
export async function readStreamCapped(
  stream: ReadableStream<Uint8Array>,
  maxBytes = Number.POSITIVE_INFINITY,
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

export function assertWithinCap(byteLength: number, maxBytes?: number): void {
  if (maxBytes !== undefined && byteLength > maxBytes) throw new FileTooLargeError();
}
