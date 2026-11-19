import { vi } from "vitest";

/**
 * State behind the mocked `next/navigation` (see ui-setup.ts). Plain module-level objects,
 * not `vi.hoisted` exports: Vitest 5 rejects exporting a hoisted variable. Tests set
 * `mockPathname.value` / `mockSearchParams.value` and assert on `routerSpies`.
 */
export const mockPathname = { value: "/" };
export const mockSearchParams = { value: new URLSearchParams() };
export const routerSpies = {
  push: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
};
