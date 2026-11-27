import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
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

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  function stubMotion(reduce: boolean) {
    vi.stubGlobal("matchMedia", (q: string) => ({ matches: reduce && q.includes("reduce") }));
    return vi.spyOn(Element.prototype, "scrollIntoView").mockImplementation(() => {});
  }

  it("a link scrolls its field to the centre, smoothly, and moves focus to it", () => {
    const scroll = stubMotion(false);
    render(<Form errors={TWO} />);
    fireEvent.click(screen.getAllByRole("link")[1]!);
    expect(document.activeElement).toBe(document.getElementById("adult"));
    expect(scroll).toHaveBeenCalledWith({ block: "center", behavior: "smooth" });
  });

  it("scrolls without animation under reduced motion", () => {
    const scroll = stubMotion(true);
    render(<Form errors={TWO} />);
    fireEvent.click(screen.getAllByRole("link")[0]!);
    expect(scroll).toHaveBeenCalledWith({ block: "center", behavior: "auto" });
  });

  it.each([{ ctrlKey: true }, { metaKey: true }, { shiftKey: true }, { button: 1 }])(
    "leaves a modified or non-primary click (%o) to the browser",
    (mods) => {
      const scroll = stubMotion(false);
      render(<Form errors={TWO} />);
      const box = document.querySelector(".errsum");
      expect(fireEvent.click(screen.getAllByRole("link")[0]!, mods)).toBe(true);
      expect(document.activeElement).toBe(box);
      expect(scroll).not.toHaveBeenCalled();
    },
  );

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
