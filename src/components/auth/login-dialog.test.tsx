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
    <>
      <input id="dlg-mobile" aria-label="Mobile number" />
      <button
        type="button"
        data-next={next}
        onClick={() => onDone({ isNewUser: false, name: " Asha Rao" })}
      >
        finish
      </button>
    </>
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
    const dialog = screen.getByRole("dialog", { name: "Sign in" });
    // The approved head: the mint swoosh, decorative, before the (sr-only) title.
    const mark = dialog.querySelector<HTMLImageElement>(".sheet-head img.sheet-mark")!;
    expect(mark.getAttribute("src")).toBe("/brand/aarvion-mark.svg");
    expect(mark.getAttribute("alt")).toBe("");
    expect(screen.getByText("finish")).toHaveAttribute("data-next", "/checkout");
  });

  it("opens on the flow's identifier field", () => {
    setup();
    expect(document.activeElement).toBe(screen.getByLabelText("Mobile number"));
  });

  it.each([
    ["/checkout", "/checkout"],
    ["//evil.com", "/"],
  ])("with next=%s it closes, tells the header, then goes to %s", async (next, to) => {
    const { onOpenChange, onSignedIn, finish } = setup(next);
    finish();
    await advance(899);
    expect(routerSpies.push).not.toHaveBeenCalled();
    await advance(1);
    expect(routerSpies.push).toHaveBeenCalledWith(to);
    // The header lives in the persistent layout: it must not stay stale under the new page.
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onSignedIn).toHaveBeenCalledTimes(1);
    const order = (f: ReturnType<typeof vi.fn>) => f.mock.invocationCallOrder[0]!;
    expect(order(onOpenChange)).toBeLessThan(order(routerSpies.push));
    expect(order(onSignedIn)).toBeLessThan(order(routerSpies.push));
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

  it.each([undefined, "/checkout"])(
    "closing during the done step (next=%s) skips the redirect and toast but still tells the header",
    async (next) => {
      const { onOpenChange, onSignedIn, finish } = setup(next);
      finish();
      fireEvent.keyDown(document.activeElement!, { key: "Escape" });
      expect(onOpenChange).toHaveBeenCalledWith(false);
      expect(onSignedIn).toHaveBeenCalledTimes(1);
      await advance(900);
      expect(onSignedIn).toHaveBeenCalledTimes(1);
      expect(toast).not.toHaveBeenCalled();
      expect(routerSpies.push).not.toHaveBeenCalled();
    },
  );

  it("closing before sign-in tells the header nothing", () => {
    const { onOpenChange, onSignedIn } = setup();
    fireEvent.keyDown(document.activeElement!, { key: "Escape" });
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onSignedIn).not.toHaveBeenCalled();
  });
});
