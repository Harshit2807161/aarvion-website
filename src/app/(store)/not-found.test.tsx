import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import StoreNotFound from "./not-found";

describe("(store) not-found", () => {
  it("is the 404 body without its own chrome, so the layout's chrome is not doubled", () => {
    const { container } = render(<StoreNotFound />);
    expect(container.querySelector("h1")?.textContent).toBe("We can’t find that page");
    expect(container.querySelector(".catbar, .store-head")).toBeNull();
  });
});
