import { BlobError, del, get, put } from "@vercel/blob";
import {
  assertSafeKey,
  assertStoredType,
  assertWithinCap,
  DEFAULT_MAX_READ_BYTES,
  FileExistsError,
  readStreamCapped,
} from "./file-keys.ts";
import type { FileStore } from "./types.ts";

/**
 * The SDK has no named error for an existing pathname under `allowOverwrite: false`: the API
 * answers a generic BlobError whose message says the blob already exists. Its internal retry can
 * also surface this for a put whose first attempt landed (see FileExistsError).
 */
const isExistsError = (err: unknown) =>
  err instanceof BlobError && /already exists/i.test(err.message);

/**
 * Private Vercel Blob store (FILE_STORE=blob), loaded on first file use by file-store.ts. Blobs
 * are `access: "private"`, so they have no public URL: they are read only through our
 * ownership-checked handlers with the store token, and no URL is ever returned. Keys are exact
 * (no random suffix) and never overwritten.
 */
export function createBlobFiles(opts: { token: string }): FileStore {
  const { token } = opts;
  return {
    kind: "blob",
    async put(key, body, contentType) {
      assertSafeKey(key);
      assertStoredType(contentType);
      try {
        await put(key, Buffer.from(body), {
          access: "private",
          contentType,
          addRandomSuffix: false,
          allowOverwrite: false,
          token,
        });
      } catch (err) {
        if (isExistsError(err)) throw new FileExistsError();
        throw err;
      }
    },
    async get(key, getOpts) {
      assertSafeKey(key);
      const maxBytes = getOpts?.maxBytes ?? DEFAULT_MAX_READ_BYTES;
      // useCache: false reads origin storage, so a just-written staging file is never missed.
      const res = await get(key, { access: "private", useCache: false, token });
      if (!res || res.statusCode !== 200) return null;
      try {
        assertWithinCap(res.blob.size, maxBytes); // fail fast on the declared size
      } catch (err) {
        await res.stream.cancel();
        throw err;
      }
      const body = await readStreamCapped(res.stream, maxBytes);
      return { body, contentType: res.blob.contentType };
    },
    async delete(key) {
      assertSafeKey(key);
      await del(key, { token });
    },
  };
}
