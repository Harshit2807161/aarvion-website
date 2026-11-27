import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { routerSpies } from "../../../tests/helpers/navigation-mocks";
import { LoginDialog } from "./login-dialog";

// The flow itself is tested in login-flow.test.tsx; here it only needs to finish.
vi.mock("./login-flow", () => ({
  DONE_MS: 900,
  LoginFlow: ({
    onDone,
    next,
  }: {
    onDone(r: { isNewUser: boolean; name: string | null }): void;
    next?: string;
  }) => (
    <button
      type="button"
      data-next={next}
      onClick={() => onDone({ isNewUser: false, name: " Asha Rao" })}
    >
      finish
    </button>
  ),
}));
vi.mock("@/components/feedback/toast", () => ({ toast: vi.fn() }));
import { toast } from "@/components/feedback/toast";

beforeEach(() => {
  vi.useFakeTimers();
  vi.mocked(toast).mockClear();
});
afterEach(() => vi.useRealTimers());

async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

function setup(next?: string) {
  const onOpenChange = vi.fn();
  const onSignedIn = vi.fn();
  render(<LoginDialog open onOpenChange={onOpenChange} onSignedIn={onSignedIn} next={next} />);
  return { onOpenChange, onSignedIn, finish: () => fireEvent.click(screen.getByText("finish")) };
}

describe("LoginDialog", () => {
  it("is a dialog named Sign in holding the flow, which gets the opener's next", () => {
    setup("/checkout");
    expect(screen.getByRole("dialog", { name: "Sign in" })).toBeInTheDocument();
    expect(screen.getByText("finish")).toHaveAttribute("data-next", "/checkout");
  });

  it.each([
    ["/checkout", "/checkout"],
    ["//evil.com", "/"],
  ])("with next=%s it goes to %s after the done step, without a toast", async (next, to) => {
    const { onOpenChange, finish } = setup(next);
    finish();
    await advance(899);
    expect(routerSpies.push).not.toHaveBeenCalled();
    await advance(1);
    expect(routerSpies.push).toHaveBeenCalledWith(to);
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(toast).not.toHaveBeenCalled();
  });

  it("without next it closes, toasts the first name and lets the header refresh", async () => {
    const { onOpenChange, onSignedIn, finish } = setup();
    finish();
    await advance(899);
    expect(onOpenChange).not.toHaveBeenCalled();
    await advance(1);
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(toast).toHaveBeenCalledWith("Signed in as Asha");
    expect(onSignedIn).toHaveBeenCalledTimes(1);
    expect(routerSpies.push).not.toHaveBeenCalled();
  });

  it("closing within the done step cancels what would follow", async () => {
    const { onOpenChange, onSignedIn, finish } = setup();
    finish();
    fireEvent.keyDown(document.activeElement!, { key: "Escape" });
    expect(onOpenChange).toHaveBeenCalledWith(false);
    onOpenChange.mockClear();
    await advance(900);
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(toast).not.toHaveBeenCalled();
    expect(onSignedIn).not.toHaveBeenCalled();
  });
});
