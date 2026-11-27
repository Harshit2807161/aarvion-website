import { EnvError, type Env } from "../env.ts";
import { isMockForbidden } from "./guard.ts";
import { createLocalFiles } from "./local-files.ts";
import { createMemoryFiles } from "./memory-files.ts";
import type { FileStore } from "./types.ts";

/**
 * The file store that `getDeps()` hands out. It is resolved on first use, not when deps are built,
 * so a mis-set FILE_STORE fails only file access (with an EnvError naming the cause) and never
 * takes OTP login or the product search down with it (review R3, I1). It is a plain object, not a
 * getter, because `getDeps()` spreads its cache. The refusals:
 * - memory and local are dev tools: refused wherever mocks are forbidden (`isMockForbidden()`);
 * - on Vercel (`VERCEL_ENV` set) each function has its own memory and a read-only disk, so a file
 *   written by one request would be missing in the next: only blob is allowed there.
 */
export function createFileStore(env: Env): FileStore {
  let resolved: Promise<FileStore> | undefined;
  const store = () => (resolved ??= resolveFileStore(env));
  return {
    kind: env.FILE_STORE,
    put: async (key, body, contentType) => (await store()).put(key, body, contentType),
    get: async (key, opts) => (await store()).get(key, opts),
    delete: async (key) => (await store()).delete(key),
  };
}

async function resolveFileStore(env: Env): Promise<FileStore> {
  if (env.FILE_STORE !== "blob" && isMockForbidden()) {
    throw new EnvError(
      `FILE_STORE=${env.FILE_STORE} is a dev store and is not allowed in production: use blob`,
    );
  }
  if (env.VERCEL_ENV !== undefined && env.FILE_STORE !== "blob") {
    throw new EnvError(
      `FILE_STORE=${env.FILE_STORE} does not persist across Vercel functions: use blob`,
    );
  }
  if (env.FILE_STORE === "blob") throw new Error("FILE_STORE=blob: not implemented yet");
  if (env.FILE_STORE === "local") return createLocalFiles(env.FILE_STORE_LOCAL_DIR);
  return createMemoryFiles();
}
