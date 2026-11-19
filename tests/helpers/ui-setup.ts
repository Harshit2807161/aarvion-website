import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

/** Mutable pathname the mocked `usePathname` reads; tests set `mockPathname.value`. */
export const mockPathname = vi.hoisted(() => ({ value: "/" }));
export const routerSpies = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => routerSpies,
  usePathname: () => mockPathname.value,
  useSearchParams: () => new URLSearchParams(),
}));

afterEach(() => {
  cleanup();
  mockPathname.value = "/";
  routerSpies.push.mockClear();
  routerSpies.replace.mockClear();
  routerSpies.refresh.mockClear();
});
