import { readFileSync } from "node:fs";
import path from "node:path";
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

  it("removes the invalid state when the error clears", () => {
    const { container, rerender } = render(
      <TextField id="m" label="Mobile" hint="Hint." error="Bad." />,
    );
    expect(container.querySelector(".field")).toHaveClass("is-invalid");
    rerender(<TextField id="m" label="Mobile" hint="Hint." error={null} />);
    const input = screen.getByLabelText("Mobile");
    expect(container.querySelector(".field")).not.toHaveClass("is-invalid");
    expect(input).not.toHaveAttribute("aria-invalid");
    expect(input).toHaveAttribute("aria-describedby", "m-hint");
    expect(document.getElementById("m-err")).toBeNull();
  });

  it("announces an error that appears while the field has focus", () => {
    render(<TextField id="m" label="Mobile" error="Bad." />);
    expect(document.getElementById("m-err")).toHaveAttribute("role", "alert");
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
    expect(screen.getByLabelText("Mobile")).toHaveClass("field-box", "input", "mono");
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

  it("announces its error and drops the error wiring when it clears", () => {
    const { container, rerender } = render(<Checkbox id="adult" label="Adult" error="Confirm." />);
    expect(document.getElementById("adult-err")).toHaveAttribute("role", "alert");
    expect(container.querySelector(".check")).toHaveClass("is-invalid");
    rerender(<Checkbox id="adult" label="Adult" error={null} />);
    const box = screen.getByRole("checkbox");
    expect(container.querySelector(".check")).not.toHaveClass("is-invalid");
    expect(box).not.toHaveAttribute("aria-invalid");
    expect(box).not.toHaveAttribute("aria-describedby");
    expect(document.getElementById("adult-err")).toBeNull();
  });

  it("has no error wiring when valid, and keeps a caller's aria-describedby", () => {
    const { rerender } = render(<Checkbox id="adult" label="Adult" />);
    const box = screen.getByRole("checkbox");
    expect(box).not.toHaveAttribute("aria-invalid");
    expect(box).not.toHaveAttribute("aria-describedby");
    rerender(<Checkbox id="adult" label="Adult" error="No." aria-describedby="extra" />);
    expect(box).toHaveAttribute("aria-describedby", "adult-err extra");
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

  describe("keyboard", () => {
    const THREE = [
      { value: "a", label: "A" },
      { value: "b", label: "B" },
      { value: "c", label: "C" },
    ] as const;
    function Harness() {
      const [v, setV] = useState<"a" | "b" | "c">("b");
      return <Segmented name="k" legend="Pick" options={THREE} value={v} onChange={setV} />;
    }
    const press = (key: string) =>
      fireEvent.keyDown(screen.getByRole("radio", { checked: true }), { key });

    it("keeps only the selected radio in the tab order", () => {
      render(<Harness />);
      expect(screen.getByRole("radio", { name: "A" })).toHaveAttribute("tabindex", "-1");
      expect(screen.getByRole("radio", { name: "B" })).toHaveAttribute("tabindex", "0");
    });

    it("moves and focuses with the arrows, wrapping at the ends", () => {
      render(<Harness />);
      press("ArrowRight");
      expect(screen.getByRole("radio", { name: "C" })).toBeChecked();
      expect(screen.getByRole("radio", { name: "C" })).toHaveFocus();
      press("ArrowDown");
      expect(screen.getByRole("radio", { name: "A" })).toBeChecked();
      press("ArrowLeft");
      expect(screen.getByRole("radio", { name: "C" })).toBeChecked();
      press("ArrowUp");
      expect(screen.getByRole("radio", { name: "B" })).toBeChecked();
    });

    it("prevents the default for handled keys and leaves the rest alone", () => {
      render(<Harness />);
      const radio = () => screen.getByRole("radio", { checked: true });
      // Modified arrows (Alt+Left is browser Back) are left to the browser.
      for (const mod of ["altKey", "metaKey", "ctrlKey", "shiftKey"]) {
        expect(fireEvent.keyDown(radio(), { key: "ArrowLeft", [mod]: true })).toBe(true);
      }
      expect(screen.getByRole("radio", { name: "B" })).toBeChecked();
      expect(fireEvent.keyDown(radio(), { key: "ArrowRight" })).toBe(false);
      expect(fireEvent.keyDown(radio(), { key: "Home" })).toBe(false);
      expect(fireEvent.keyDown(radio(), { key: "x" })).toBe(true);
    });

    it("keeps the group reachable when the value matches no option", () => {
      render(
        <Segmented
          name="k"
          legend="Pick"
          options={THREE}
          value={"zzz" as "a"}
          onChange={() => {}}
        />,
      );
      expect(screen.getByRole("radio", { name: "A" })).toHaveAttribute("tabindex", "0");
      expect(screen.getByRole("radio", { name: "B" })).toHaveAttribute("tabindex", "-1");
    });

    it("jumps with Home and End and ignores other keys", () => {
      render(<Harness />);
      press("End");
      expect(screen.getByRole("radio", { name: "C" })).toBeChecked();
      press("Home");
      expect(screen.getByRole("radio", { name: "A" })).toBeChecked();
      press("x");
      expect(screen.getByRole("radio", { name: "A" })).toBeChecked();
    });
  });

  it("sets --i and --n for any option count", () => {
    const four = ["a", "b", "c", "d"].map((v) => ({ value: v, label: v.toUpperCase() }));
    const { container } = render(
      <Segmented name="four" legend="Four" options={four} value="d" onChange={() => {}} />,
    );
    const seg = container.querySelector("fieldset.seg") as HTMLElement;
    expect(seg.style.getPropertyValue("--n")).toBe("4");
    expect(seg.style.getPropertyValue("--i")).toBe("3");
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

describe("forms.css", () => {
  const css = readFileSync(path.resolve(import.meta.dirname, "../../styles/forms.css"), "utf8");

  it("keeps keyboard focus visible in forced-colors mode", () => {
    expect(css).toMatch(
      /@media \(forced-colors: active\)[^}]*\.input:focus[^}]*outline: 2px solid Highlight/,
    );
  });

  it("covers the checkbox and segmented control in forced-colors and contrast-more", () => {
    expect(css).toMatch(
      /@media \(forced-colors: active\)[^@]*\.check-input:checked \+ \.check-box/,
    );
    expect(css).toMatch(/@media \(forced-colors: active\)[^@]*\.seg-thumb \{ border/);
    expect(css).toMatch(/@media \(prefers-contrast: more\)[^@]*\.check-box/);
  });

  it("styles a disabled checkbox as unavailable", () => {
    expect(css).toMatch(/\.check-input:is\(:disabled, \[aria-disabled="true"\]\) \+ \.check-box/);
    expect(css).not.toMatch(/seg:has\(\.seg-input:nth-of-type/);
  });

  it("keeps the shared field box in one rule", () => {
    expect(css.match(/font-size: 16px/g)).toHaveLength(1);
  });

  it("supports prefers-contrast: more for hints", () => {
    expect(css).toMatch(/@media \(prefers-contrast: more\)[^}]*\.hint/);
  });
});

describe("errorAlert={false} (an error summary speaks for the form)", () => {
  it("TextField keeps the error and its link but drops role=alert", () => {
    render(<TextField id="n" label="Full name" error="Enter a name." errorAlert={false} />);
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByLabelText("Full name")).toHaveAttribute("aria-describedby", "n-err");
    expect(document.getElementById("n-err")).toHaveTextContent("Enter a name.");
  });

  it("Checkbox keeps the error and its link but drops role=alert", () => {
    render(<Checkbox id="a" label="I am 18 or older" error="Confirm." errorAlert={false} />);
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByLabelText("I am 18 or older")).toHaveAttribute("aria-describedby", "a-err");
  });

  it("both still default to role=alert", () => {
    render(
      <>
        <TextField id="n" label="Full name" error="Enter a name." />
        <Checkbox id="a" label="Adult" error="Confirm." />
      </>,
    );
    expect(screen.getAllByRole("alert")).toHaveLength(2);
  });
});
