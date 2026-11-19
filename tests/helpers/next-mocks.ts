// Int-project setup file (vitest.config.ts). Int tests call route handlers and cached reads
// directly, outside a Next server, where `connection()` and the cache APIs throw. Only
// `pnpm build` proves the real behaviour.
import { cacheLife, cacheTag, revalidateTag } from "next/cache";
import { beforeEach, vi } from "vitest";

vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  connection: vi.fn(async () => {}),
}));

vi.mock("next/cache", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/cache")>()),
  cacheTag: vi.fn(),
  cacheLife: vi.fn(),
  revalidateTag: vi.fn(),
}));

/** The recorded Next cache calls, cleared before each test. */
export const nextCache = {
  cacheTag: vi.mocked(cacheTag),
  cacheLife: vi.mocked(cacheLife),
  revalidateTag: vi.mocked(revalidateTag),
};

beforeEach(() => {
  for (const spy of Object.values(nextCache)) spy.mockClear();
});
