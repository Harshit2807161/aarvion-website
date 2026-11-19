import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

const hoisted = vi.hoisted(() => ({
  mockPathname: { value: "/" },
  mockSearchParams: { value: new URLSearchParams() },
  routerSpies: { push: vi.fn(), replace: vi.fn(), refresh: vi.fn() },
}));

/** Mutable pathname the mocked `usePathname` reads; tests set `mockPathname.value`. */
export const mockPathname = hoisted.mockPathname;
/** Search params the mocked `useSearchParams` returns; one stable object, settable per test. */
export const mockSearchParams = hoisted.mockSearchParams;
export const routerSpies = hoisted.routerSpies;

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
