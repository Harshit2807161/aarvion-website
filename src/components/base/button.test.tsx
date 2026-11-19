import { fireEvent, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { Button, ButtonLink, buttonClass } from "./button";

describe("buttonClass", () => {
  it("defaults to forest at the base size", () => {
    expect(buttonClass()).toBe("btn btn-forest");
  });

  it("adds size and block modifiers", () => {
    expect(buttonClass({ variant: "forest", size: "lg", block: true })).toBe(
      "btn btn-forest btn-lg btn-block",
    );
    expect(buttonClass({ variant: "sand", size: "sm" })).toBe("btn btn-sand btn-sm");
  });

  it("renders the link variant as the plain underlined link", () => {
    expect(buttonClass({ variant: "link" })).toBe("link");
  });
});

describe("Button", () => {
  it("renders a type=button button with the label and optional icon", () => {
    render(<Button icon="plus">Add</Button>);
    const b = screen.getByRole("button", { name: "Add" });
    expect(b.getAttribute("type")).toBe("button");
    expect(b.className).toBe("btn btn-forest");
    expect(b.querySelector("svg.i")).not.toBeNull();
  });

  it("calls onClick when idle", () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Go</Button>);
    fireEvent.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("while busy shows the spinner and busy text, sets aria, and ignores clicks", () => {
    const onClick = vi.fn();
    const { container } = render(
      <Button busy="Sending code…" onClick={onClick}>
        Send code
      </Button>,
    );
    const b = screen.getByRole("button");
    expect(b.getAttribute("aria-busy")).toBe("true");
    expect(b.getAttribute("aria-disabled")).toBe("true");
    expect(b.classList.contains("is-busy")).toBe(true);
    expect(container.querySelector(".spin")).not.toBeNull();
    expect(b.textContent).toBe("Sending code…");
    fireEvent.click(b);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("is not busy for busy={false}", () => {
    render(<Button busy={false}>Send code</Button>);
    expect(screen.getByRole("button").hasAttribute("aria-busy")).toBe(false);
  });
});

describe("busy submit button inside a form", () => {
  function setup() {
    const onSubmit = vi.fn((e: React.FormEvent) => e.preventDefault());
    const onClick = vi.fn();
    render(
      <form onSubmit={onSubmit}>
        <input aria-label="phone" />
        <Button type="submit" busy="Sending…" onClick={onClick}>
          Send
        </Button>
      </form>,
    );
    return { onSubmit, onClick };
  }

  it("does not submit when the busy button is clicked", () => {
    const { onSubmit, onClick } = setup();
    fireEvent.click(screen.getByRole("button"));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(onClick).not.toHaveBeenCalled();
  });

  it("does not submit on implicit submission (Enter in a field fires the default button's click)", () => {
    const { onSubmit } = setup();
    const input = screen.getByLabelText("phone");
    fireEvent.keyDown(input, { key: "Enter" });
    // Browsers answer Enter in a field by clicking the form's default submit button.
    (screen.getByRole("button") as HTMLButtonElement).click();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("submits normally when not busy", () => {
    const onSubmit = vi.fn((e: React.FormEvent) => e.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <Button type="submit">Send</Button>
      </form>,
    );
    fireEvent.click(screen.getByRole("button"));
    expect(onSubmit).toHaveBeenCalledOnce();
  });
});

describe("server safety", () => {
  it("keeps button.tsx (buttonClass, ButtonLink) free of a client directive; only button.client.tsx has one", () => {
    const dir = path.resolve(import.meta.dirname);
    const directive = /^\s*["']use client["']/m;
    expect(readFileSync(path.join(dir, "button.tsx"), "utf8")).not.toMatch(directive);
    expect(readFileSync(path.join(dir, "button-class.ts"), "utf8")).not.toMatch(directive);
    expect(readFileSync(path.join(dir, "button.client.tsx"), "utf8")).toMatch(directive);
  });

  it("renders ButtonLink and buttonClass without any client runtime (static markup)", () => {
    const html = renderToStaticMarkup(
      <ButtonLink href="/x" variant="quiet" size="sm" icon="arrow">
        Go
      </ButtonLink>,
    );
    expect(html).toContain('class="btn btn-quiet btn-sm"');
    expect(buttonClass({ variant: "link" })).toBe("link");
  });
});

describe("ButtonLink", () => {
  it("renders an anchor with button classes", () => {
    const { container } = render(
      <ButtonLink href="/x" variant="sand">
        Next
      </ButtonLink>,
    );
    expect(container.querySelector('a[href="/x"].btn.btn-sand')).not.toBeNull();
  });
});
