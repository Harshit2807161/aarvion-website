import { render, screen } from "@testing-library/react";
import { usePathname, useRouter } from "next/navigation";
import { expect, it } from "vitest";
import { mockPathname, routerSpies } from "../../tests/helpers/navigation-mocks";

it("runs the ui project with jest-dom matchers", () => {
  render(<div>hello</div>);
  expect(screen.getByText("hello")).toBeInTheDocument();
});

it("mocks next/navigation from the shared state", () => {
  mockPathname.value = "/legal/terms";
  expect(usePathname()).toBe("/legal/terms");
  useRouter().push("/a");
  expect(routerSpies.push).toHaveBeenCalledWith("/a");
});
