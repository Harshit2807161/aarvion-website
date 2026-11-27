import { assertSafeKey, assertWithinCap } from "./file-keys.ts";
import type { FileStore } from "./types.ts";

/** Per-process store for tests and e2e. Refused on Vercel and in production (deps.ts). */
export function createMemoryFiles(): FileStore {
  const store = new Map<string, { body: Uint8Array; contentType: string }>();
  return {
    kind: "memory",
    async put(path, body, contentType) {
      assertSafeKey(path);
      store.set(path, { body: body.slice(), contentType });
    },
    async get(path, opts) {
      assertSafeKey(path);
      const hit = store.get(path);
      if (!hit) return null;
      assertWithinCap(hit.body.byteLength, opts?.maxBytes);
      return { body: hit.body.slice(), contentType: hit.contentType };
    },
    async delete(path) {
      assertSafeKey(path);
      store.delete(path);
    },
  };
}
