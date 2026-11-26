import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ErrorSummary } from "./error-summary";

function Form({
  errors,
  focusKey = 1,
}: {
  errors: { id: string; message: string }[];
  focusKey?: number;
}) {
  return (
    <>
      <ErrorSummary errors={errors} focusKey={focusKey} />
      <input id="name" aria-label="Full name" />
      <input id="adult" type="checkbox" aria-label="Adult" />
    </>
  );
}

const TWO = [
  { id: "name", message: "Enter the full name, at least 2 letters." },
  { id: "adult", message: "Confirm that you are 18 or older to create an account." },
];

describe("ErrorSummary", () => {
  it("counts the problems, lists each as a link to its field and takes focus", () => {
    render(<Form errors={TWO} />);
    const box = document.querySelector(".errsum")!;
    expect(box).toHaveTextContent("There are 2 problems");
    expect(box).toHaveAttribute("tabindex", "-1");
    expect(document.activeElement).toBe(box);
    const links = screen.getAllByRole("link");
    expect(links.map((a) => a.getAttribute("href"))).toEqual(["#name", "#adult"]);
    expect(links[0]).toHaveTextContent(TWO[0]!.message);
  });

  it("says there is one problem in the singular", () => {
    render(<Form errors={TWO.slice(0, 1)} />);
    expect(document.querySelector(".errsum")).toHaveTextContent("There’s a problem");
  });

  it("a link moves focus to its field", () => {
    render(<Form errors={TWO} />);
    fireEvent.click(screen.getAllByRole("link")[1]!);
    expect(document.activeElement).toBe(document.getElementById("adult"));
  });

  it("takes focus again on each new submit, and renders nothing without errors", () => {
    const { rerender } = render(<Form errors={TWO} focusKey={1} />);
    document.getElementById("name")!.focus();
    rerender(<Form errors={TWO} focusKey={2} />);
    expect(document.activeElement).toBe(document.querySelector(".errsum"));
    rerender(<Form errors={[]} focusKey={3} />);
    expect(document.querySelector(".errsum")).toBeNull();
  });

  it("is no live region and no alert: focus is what announces it", () => {
    render(<Form errors={TWO} />);
    expect(document.querySelectorAll("[aria-live], [role=alert], [role=status]")).toHaveLength(0);
  });
});
