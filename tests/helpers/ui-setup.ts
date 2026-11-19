import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";
import { mockPathname, mockSearchParams, routerSpies } from "./next-mocks";

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
