import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRef, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LoginDialog } from "./login-dialog";
import { LOGIN_COPY } from "./login-machine";

/**
 * Focus with the real LoginFlow inside (login-dialog.test.tsx stubs the flow): the dialog opens on
 * the flow's identifier field and gives focus back to the control that opened it.
 */
beforeEach(() => {
  // Signed out: the flow's own session check finds nobody.
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ user: null }) })),
  );
});
afterEach(() => vi.unstubAllGlobals());

function Header() {
  const [open, setOpen] = useState(false);
  const pill = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button type="button" ref={pill} onClick={() => setOpen(true)}>
        Sign in
      </button>
      <LoginDialog open={open} onOpenChange={setOpen} returnFocusTo={pill} />
    </>
  );
}

describe("LoginDialog focus, with the real flow", () => {
  it("opens on the mobile field and returns focus to the opener on close", async () => {
    const user = userEvent.setup();
    render(<Header />);
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    expect(screen.getByRole("dialog", { name: "Sign in" })).toBeInTheDocument();
    expect(screen.getByLabelText(LOGIN_COPY.mobileLabel)).toHaveFocus();

    await user.keyboard("{Escape}");
    await act(async () => {});
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByRole("button", { name: "Sign in" })).toHaveFocus();
  });

  it("the Close button also returns focus to the opener", async () => {
    const user = userEvent.setup();
    render(<Header />);
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    await user.click(screen.getByRole("button", { name: "Close sign in" }));
    await act(async () => {});
    expect(screen.getByRole("button", { name: "Sign in" })).toHaveFocus();
  });
});
