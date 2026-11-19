import { act, fireEvent, render } from "@testing-library/react";
import { readFileSync } from "node:fs";
import path from "node:path";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { OTP_LENGTH, OtpField, otpDigits } from "./otp-field";

type Props = Partial<React.ComponentProps<typeof OtpField>>;

function Harness({ initial = "", onChange, onComplete, ...rest }: Props & { initial?: string }) {
  const [value, setValue] = useState(initial);
  return (
    <OtpField
      id="otp"
      value={value}
      onChange={(v) => {
        setValue(v);
        onChange?.(v);
      }}
      onComplete={onComplete ?? (() => {})}
      state="idle"
      {...rest}
    />
  );
}

function input(): HTMLInputElement {
  return document.querySelector("input") as HTMLInputElement;
}

function paste(el: HTMLElement, text: string) {
  fireEvent.paste(el, { clipboardData: { getData: () => text } });
}

describe("otpDigits", () => {
  it("keeps the first six digits of whatever was pasted", () => {
    expect(OTP_LENGTH).toBe(6);
    expect(otpDigits("482913 is your Aarvion login code. It expires in 5 minutes.")).toBe("482913");
    expect(otpDigits("123 456")).toBe("123456");
    expect(otpDigits("12a3")).toBe("123");
    expect(otpDigits("1234567890")).toBe("123456");
    expect(otpDigits("")).toBe("");
  });
});

describe("OtpField", () => {
  it("is one real input plus six aria-hidden boxes", () => {
    const { container } = render(<Harness />);
    expect(container.querySelectorAll("input")).toHaveLength(1);
    const el = input();
    expect(el.getAttribute("autocomplete")).toBe("one-time-code");
    expect(el.getAttribute("inputmode")).toBe("numeric");
    expect(el.getAttribute("maxlength")).toBe("6");
    expect(el.id).toBe("otp");
    const boxes = container.querySelectorAll(".otp-box");
    expect(boxes).toHaveLength(6);
    boxes.forEach((b) => expect(b.getAttribute("aria-hidden")).toBe("true"));
  });

  it("draws the typed digits in the boxes", () => {
    const { container } = render(<Harness initial="48" />);
    const boxes = [...container.querySelectorAll(".otp-box")];
    expect(boxes.map((b) => b.textContent)).toEqual(["4", "8", "", "", "", ""]);
    expect(boxes[0]!.classList.contains("is-filled")).toBe(true);
    expect(boxes[2]!.classList.contains("is-filled")).toBe(false);
  });

  it("pastes a whole SMS and completes once", () => {
    const onChange = vi.fn();
    const onComplete = vi.fn();
    render(<Harness onChange={onChange} onComplete={onComplete} />);
    paste(input(), "482913 is your Aarvion login code. It expires in 5 minutes.");
    expect(onChange).toHaveBeenLastCalledWith("482913");
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledWith("482913");
  });

  it("a pasted full code replaces a partial value instead of landing at the caret", () => {
    const onChange = vi.fn();
    const onComplete = vi.fn();
    render(<Harness initial="48" onChange={onChange} onComplete={onComplete} />);
    paste(input(), "Your code is 482913");
    expect(onChange).toHaveBeenLastCalledWith("482913");
    expect(input().value).toBe("482913");
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledWith("482913");
  });

  it("a partial paste still goes through input-otp at the caret", () => {
    const onChange = vi.fn();
    render(<Harness initial="48" onChange={onChange} />);
    paste(input(), "29");
    expect(onChange).toHaveBeenLastCalledWith("4829");
  });

  it("names the input with ariaLabel and uses the numeric pattern", () => {
    render(<Harness ariaLabel="Login code" />);
    expect(input().getAttribute("aria-label")).toBe("Login code");
    expect(input().getAttribute("pattern")).toBe("^[0-9]*$");
  });

  it.each([
    ["123 456", "123456"],
    ["12a3", "123"],
  ])("pasting %j gives %j", (text, expected) => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    paste(input(), text);
    expect(onChange).toHaveBeenLastCalledWith(expected);
  });

  it("fires onComplete again for the same code once it was cleared", () => {
    const onComplete = vi.fn();
    render(<Harness onComplete={onComplete} />);
    paste(input(), "111111");
    fireEvent.change(input(), { target: { value: "11111" } });
    paste(input(), "111111");
    expect(onComplete).toHaveBeenCalledTimes(2);
  });

  it("locked disables the input; invalid adds is-invalid", () => {
    const { container, rerender } = render(<Harness state="locked" />);
    expect(input().disabled).toBe(true);
    expect(container.querySelector(".otp")!.classList.contains("is-locked")).toBe(true);
    rerender(<Harness state="invalid" />);
    expect(input().disabled).toBe(false);
    expect(input().getAttribute("aria-invalid")).toBe("true");
    expect(container.querySelector(".otp")!.classList.contains("is-invalid")).toBe(true);
  });

  it("links describedBy and autofocuses on request", () => {
    render(<Harness describedBy="hint" autoFocus />);
    expect(input().getAttribute("aria-describedby")).toBe("hint");
    expect(document.activeElement).toBe(input());
  });

  it("follows a change of the motion preference after mount", () => {
    const original = window.matchMedia;
    let matches = false;
    const listeners = new Set<() => void>();
    window.matchMedia = ((q: string) => ({
      get matches() {
        return matches;
      },
      media: q,
      addEventListener: (_: string, l: () => void) => listeners.add(l),
      removeEventListener: (_: string, l: () => void) => listeners.delete(l),
    })) as unknown as typeof window.matchMedia;
    try {
      const { container, unmount } = render(<Harness state="invalid" />);
      const otp = container.querySelector(".otp")!;
      expect(otp.classList.contains("shake")).toBe(false);
      matches = true;
      act(() => listeners.forEach((l) => l()));
      expect(otp.classList.contains("shake")).toBe(true);
      unmount();
      expect(listeners.size).toBe(0);
    } finally {
      window.matchMedia = original;
    }
  });

  it("shakes on invalid only when motion is allowed", () => {
    const original = window.matchMedia;
    const stub = (matches: boolean) => (q: string) =>
      ({
        matches,
        media: q,
        addEventListener() {},
        removeEventListener() {},
      }) as unknown as MediaQueryList;
    try {
      window.matchMedia = stub(true);
      const a = render(<Harness state="invalid" />);
      expect(a.container.querySelector(".otp")!.classList.contains("shake")).toBe(true);
      a.unmount();
      window.matchMedia = stub(false);
      const b = render(<Harness state="invalid" />);
      expect(b.container.querySelector(".otp")!.classList.contains("shake")).toBe(false);
    } finally {
      window.matchMedia = original;
    }
  });
});

describe("otp.css", () => {
  const css = readFileSync(path.resolve(import.meta.dirname, "../../styles/otp.css"), "utf8");

  it("keeps the input at 16px so iOS never zooms, and renames --line-strong [C13]", () => {
    expect(css).toMatch(/\.otp-input[^{]*\{[^}]*font-size: 16px !important/);
    expect(css).not.toMatch(/var\(--line-strong\)/);
    expect(css).toContain("var(--color-line-strong)");
  });
});
