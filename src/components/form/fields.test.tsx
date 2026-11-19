import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { Checkbox } from "./checkbox";
import { Segmented } from "./segmented";
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

describe("Checkbox", () => {
  it("toggles when its label is clicked", () => {
    render(<Checkbox id="adult" label="I am 18 or older" />);
    const box = screen.getByRole("checkbox", { name: "I am 18 or older" });
    expect(box).not.toBeChecked();
    fireEvent.click(screen.getByText("I am 18 or older"));
    expect(box).toBeChecked();
  });

  it("shows the sub line and ties the error to the input", () => {
    render(<Checkbox id="adult" label="Adult" sub="Optional." error="Confirm your age." />);
    const box = screen.getByRole("checkbox");
    expect(box).toHaveAttribute("aria-invalid", "true");
    expect(box).toHaveAttribute("aria-describedby", "adult-err");
    expect(document.getElementById("adult-err")).toHaveTextContent("Confirm your age.");
    expect(screen.getByText("Optional.")).toBeInTheDocument();
  });

  it("has no error wiring when valid", () => {
    render(<Checkbox id="adult" label="Adult" />);
    const box = screen.getByRole("checkbox");
    expect(box).not.toHaveAttribute("aria-invalid");
    expect(box).not.toHaveAttribute("aria-describedby");
  });
});

describe("Segmented", () => {
  const OPTIONS = [
    { value: "mobile", label: "Mobile" },
    { value: "email", label: "Email", icon: "mail" },
  ] as const;

  it("is a fieldset with --n, a screen-reader legend and native radios", () => {
    const { container } = render(
      <Segmented
        name="via"
        legend="Sign in with"
        options={OPTIONS}
        value="mobile"
        onChange={() => {}}
      />,
    );
    const seg = container.querySelector("fieldset.seg") as HTMLElement;
    expect(seg.style.getPropertyValue("--n")).toBe("2");
    expect(seg.querySelector("legend")).toHaveClass("sr-only");
    expect(screen.getByRole("group", { name: "Sign in with" })).toBe(seg);
    expect(screen.getByRole("radio", { name: "Mobile" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Email" })).not.toBeChecked();
  });

  it("calls onChange with the option's value", () => {
    const onChange = vi.fn();
    render(
      <Segmented
        name="via"
        legend="Sign in with"
        options={OPTIONS}
        value="mobile"
        onChange={onChange}
      />,
    );
    fireEvent.click(screen.getByText("Email"));
    expect(onChange).toHaveBeenCalledWith("email");
  });

  it("moves the selection when controlled", () => {
    function Harness() {
      const [v, setV] = useState<"mobile" | "email">("mobile");
      return <Segmented name="via" legend="Via" options={OPTIONS} value={v} onChange={setV} />;
    }
    render(<Harness />);
    fireEvent.click(screen.getByText("Email"));
    expect(screen.getByRole("radio", { name: "Email" })).toBeChecked();
  });
});
