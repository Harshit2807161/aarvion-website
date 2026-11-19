import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RxBadge, StatusTag } from "./badge";

describe("RxBadge", () => {
  it("is an abbr titled Prescription required", () => {
    const { container } = render(<RxBadge />);
    const el = container.querySelector("abbr.rx");
    expect(el?.getAttribute("title")).toBe("Prescription required");
    expect(el?.textContent).toBe("Rx");
  });

  it("has a larger size for the cart group head", () => {
    const { container } = render(<RxBadge size="lg" />);
    expect(container.querySelector("abbr.rx.rx--lg")).not.toBeNull();
  });
});

describe("StatusTag", () => {
  it("renders the tone class, an aria-hidden dot and the words", () => {
    const { container } = render(<StatusTag tone="hold">On hold</StatusTag>);
    const el = container.querySelector(".tag.tag--hold")!;
    expect(el.textContent).toBe("On hold");
    expect(el.querySelector('.tag-dot[aria-hidden="true"]')).not.toBeNull();
  });
});
