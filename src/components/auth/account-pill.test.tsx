import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { routerSpies } from "../../../tests/helpers/navigation-mocks";
import { AccountPill, openLogin } from "./account-pill";
import { loadLoginDialog } from "./load-login-dialog";

// The dialog module is loaded through this one function, so a test can count the loads.
vi.mock("./load-login-dialog", () => ({
  loadLoginDialog: vi.fn(() => import("./login-dialog").then((m) => m.LoginDialog)),
}));
// The flow itself is tested in login-flow.test.tsx; here it only needs to finish.
vi.mock("./login-flow", () => ({
  DONE_MS: 900,
  LoginFlow: ({ onDone }: { onDone(r: { isNewUser: boolean; name: string | null }): void }) => (
    <button type="button" onClick={() => onDone({ isNewUser: false, name: "Asha Rao" })}>
      finish
    </button>
  ),
}));
vi.mock("@/components/feedback/toast", () => ({ toast: vi.fn() }));
import { toast } from "@/components/feedback/toast";

let session: { name: string | null } | null;

beforeEach(() => {
  vi.useFakeTimers();
  session = null;
  vi.mocked(loadLoginDialog).mockClear();
  vi.mocked(toast).mockClear();
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ user: session }) })),
  );
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

/** Advances the fake clock; the first open's dynamic import also needs real module loading. */
async function settle(ms = 50) {
  await act(async () => {
    await vi.dynamicImportSettled();
    await vi.advanceTimersByTimeAsync(ms);
  });
}

const pill = () => document.querySelector<HTMLAnchorElement>("[data-account-pill]")!;

describe("AccountPill", () => {
  it("signed out: a Sign in link to /login whose plain click opens the dialog, loaded once", async () => {
    render(<AccountPill />);
    await settle();
    expect(pill()).toHaveAccessibleName("Sign in");
    expect(pill()).toHaveAttribute("href", "/login");
    expect(pill().classList.contains("sh-acct")).toBe(true);

    expect(fireEvent.click(pill())).toBe(false); // default prevented: no navigation
    await settle();
    expect(screen.getByRole("dialog", { name: "Sign in" })).toBeInTheDocument();

    fireEvent.keyDown(document.activeElement!, { key: "Escape" });
    await settle();
    fireEvent.click(pill());
    await settle();
    expect(loadLoginDialog).toHaveBeenCalledTimes(1);
  });

  it.each([{ metaKey: true }, { ctrlKey: true }, { shiftKey: true }])(
    "leaves a modified click (%o) to the browser",
    async (mods) => {
      render(<AccountPill />);
      await settle();
      expect(fireEvent.click(pill(), mods)).toBe(true);
      await settle();
      expect(screen.queryByRole("dialog")).toBeNull();
      expect(loadLoginDialog).not.toHaveBeenCalled();
    },
  );

  it("signed in: Your account, with the initial in the sand dot", async () => {
    session = { name: "Asha Rao" };
    render(<AccountPill />);
    await settle();
    expect(pill()).toHaveAccessibleName("Your account");
    expect(pill()).toHaveAttribute("href", "/account");
    expect(pill()).toHaveAttribute("data-signed-in");
    expect(pill().querySelector(".acct-dot")).toHaveTextContent("A");
    expect(pill().querySelector(".acct-label")).toHaveTextContent("Account");
  });

  it.each([
    ["E\u0301va Shah", "E\u0301"],
    ["😀 Ravi", "😀"],
    ["  asha", "A"],
  ])("the initial of %j is its first grapheme, %j", async (name, initial) => {
    session = { name };
    render(<AccountPill />);
    await settle();
    expect(pill().querySelector(".acct-dot")!.textContent).toBe(initial);
  });

  it("on /login itself a click follows the link instead of opening a dialog", async () => {
    window.history.pushState({}, "", "/login");
    try {
      render(<AccountPill />);
      await settle();
      expect(fireEvent.click(pill())).toBe(true);
      await settle();
      expect(loadLoginDialog).not.toHaveBeenCalled();
    } finally {
      window.history.pushState({}, "", "/");
    }
  });

  it("openLogin(next) opens the dialog and, once signed in, pushes the sanitised next", async () => {
    render(<AccountPill />);
    await settle();
    act(() => openLogin("/checkout"));
    await settle();
    fireEvent.click(screen.getByRole("button", { name: "finish" }));
    await settle(900);
    expect(routerSpies.push).toHaveBeenCalledWith("/checkout");
    expect(toast).not.toHaveBeenCalled();
  });

  it("openLogin with returnFocusId: the real dialog returns focus there, after sign-in or Escape", async () => {
    // The upload form asks this after a 401, so the shopper lands back on its Send (review E-M1).
    render(
      <>
        <AccountPill />
        <button type="button" id="rx-send">
          Send for review
        </button>
      </>,
    );
    await settle();
    const send = screen.getByRole("button", { name: "Send for review" });
    send.focus();
    act(() => openLogin(undefined, { returnFocusId: "rx-send" }));
    await settle();
    expect(screen.getByRole("dialog", { name: "Sign in" })).toBeInTheDocument();
    fireEvent.keyDown(document.activeElement!, { key: "Escape" });
    await settle();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(send).toHaveFocus();

    pill().focus();
    act(() => openLogin(undefined, { returnFocusId: "rx-send" }));
    await settle();
    fireEvent.click(screen.getByRole("button", { name: "finish" }));
    await settle(900);
    await settle();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(send).toHaveFocus();

    // A plain click on the pill still returns focus to the pill.
    fireEvent.click(pill());
    await settle();
    fireEvent.keyDown(document.activeElement!, { key: "Escape" });
    await settle();
    expect(pill()).toHaveFocus();
  });

  it("without next: closes, toasts Signed in as <first name> and shows the account", async () => {
    render(<AccountPill />);
    await settle();
    fireEvent.click(pill());
    await settle();
    session = { name: "Asha Rao" };
    fireEvent.click(screen.getByRole("button", { name: "finish" }));
    await settle(899);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    await settle(1);
    await settle();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(toast).toHaveBeenCalledWith("Signed in as Asha");
    expect(pill()).toHaveAccessibleName("Your account");
    expect(routerSpies.push).not.toHaveBeenCalled();
  });
});
