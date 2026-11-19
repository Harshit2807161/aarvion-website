import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

/** Mutable pathname the mocked `usePathname` reads; tests set `mockPathname.value`. */
export const mockPathname = vi.hoisted(() => ({ value: "/" }));
/** Search params the mocked `useSearchParams` returns; one stable object, settable per test. */
export const mockSearchParams = vi.hoisted(() => ({ value: new URLSearchParams() }));
export const routerSpies = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => routerSpies,
  usePathname: () => mockPathname.value,
  useSearchParams: () => mockSearchParams.value,
}));

afterEach(() => {
  cleanup();
  mockPathname.value = "/";
  mockSearchParams.value = new URLSearchParams();
  routerSpies.push.mockClear();
  routerSpies.replace.mockClear();
  routerSpies.refresh.mockClear();
});
