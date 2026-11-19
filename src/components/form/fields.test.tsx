import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TextField } from "./text-field";

describe("TextField", () => {
  it("associates a visible label with the input", () => {
    render(<TextField id="m" label="Mobile number" />);
    expect(screen.getByLabelText("Mobile number")).toBe(document.getElementById("m"));
  });

  it("describes the input by its hint, and by the error too when there is one", () => {
    const { rerender } = render(<TextField id="m" label="Mobile" hint="Indian numbers only." />);
    const input = screen.getByLabelText("Mobile");
    expect(input).toHaveAttribute("aria-describedby", "m-hint");
    expect(input).not.toHaveAttribute("aria-invalid");

    rerender(
      <TextField id="m" label="Mobile" hint="Indian numbers only." error="Enter 10 digits." />,
    );
    expect(input).toHaveAttribute("aria-describedby", "m-hint m-err");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(document.getElementById("m-err")).toHaveTextContent("Enter 10 digits.");
  });

  it("does not point at a hint that is not rendered", () => {
    render(<TextField id="m" label="Mobile" error="Required." />);
    expect(screen.getByLabelText("Mobile")).toHaveAttribute("aria-describedby", "m-err");
  });

  it("keeps a caller's aria-describedby", () => {
    render(<TextField id="m" label="Mobile" aria-describedby="extra" />);
    expect(screen.getByLabelText("Mobile")).toHaveAttribute("aria-describedby", "extra");
  });

  it("renders the prefix as an aria-hidden span and the mono modifier", () => {
    const { container } = render(<TextField id="m" label="Mobile" prefix="+91" mono />);
    const prefix = container.querySelector(".prefix[aria-hidden]");
    expect(prefix).toHaveTextContent("+91");
    expect(container.querySelector(".input-wrap")).toHaveClass("has-prefix");
    expect(screen.getByLabelText("Mobile")).toHaveClass("input", "mono");
  });

  it("passes input props through", () => {
    render(<TextField id="m" label="Mobile" type="tel" inputMode="numeric" required />);
    const input = screen.getByLabelText("Mobile");
    expect(input).toHaveAttribute("type", "tel");
    expect(input).toBeRequired();
  });
});
