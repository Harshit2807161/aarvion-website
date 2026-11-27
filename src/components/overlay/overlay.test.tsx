import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRef, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Overlay, type OverlayProps } from "./overlay";

type Props = Partial<Pick<OverlayProps, "variant" | "count" | "footer" | "initialFocus">> & {
  onOpenChange?: (open: boolean) => void;
  focusEmail?: boolean;
  returnToFallback?: boolean;
};

function Harness({
  variant = "dialog",
  onOpenChange,
  focusEmail,
  returnToFallback,
  ...rest
}: Props) {
  const [open, setOpen] = useState(false);
  const email = useRef<HTMLInputElement>(null);
  const fallback = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Open sign in
      </button>
      <button type="button" ref={fallback}>
        Fallback
      </button>
      <p>Outside content</p>
      <Overlay
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          onOpenChange?.(next);
        }}
        variant={variant}
        title="Sign in"
        closeLabel="Close sign in"
        initialFocus={focusEmail ? email : undefined}
        returnFocusTo={returnToFallback ? fallback : undefined}
        {...rest}
      >
        <label>
          Email
          <input ref={email} type="email" />
        </label>
        <button type="button">Send code</button>
      </Overlay>
    </>
  );
}

async function openIt(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Open sign in" }));
  return screen.getByRole("dialog", { name: "Sign in" });
}

describe("Overlay", () => {
  it("opens a modal dialog named by its title and focuses initialFocus", async () => {
    const user = userEvent.setup();
    render(<Harness focusEmail />);
    expect(screen.queryByRole("dialog")).toBeNull();
    const dialog = await openIt(user);
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(screen.getByLabelText("Email")).toHaveFocus();
  });

  it("initialFocus may be a function, called at open, for an element the children own", async () => {
    const user = userEvent.setup();
    render(<Harness initialFocus={() => document.querySelector("input")} />);
    await openIt(user);
    expect(screen.getByLabelText("Email")).toHaveFocus();
  });

  it("traps focus: Tab from the last focusable wraps to the first", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await openIt(user);
    const first = screen.getByRole("button", { name: "Close sign in" });
    const last = screen.getByRole("button", { name: "Send code" });
    act(() => last.focus());
    await user.tab();
    expect(first).toHaveFocus();
  });

  it("closes on Escape and returns focus to the trigger", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(<Harness onOpenChange={onOpenChange} />);
    await openIt(user);
    await user.keyboard("{Escape}");
    expect(onOpenChange).toHaveBeenLastCalledWith(false);
    expect(screen.getByRole("button", { name: "Open sign in" })).toHaveFocus();
  });

  it("closes on a scrim click", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(<Harness onOpenChange={onOpenChange} />);
    await openIt(user);
    const scrim = document.querySelector(".sheet-scrim");
    expect(scrim).not.toBeNull();
    await user.click(scrim as Element);
    expect(onOpenChange).toHaveBeenLastCalledWith(false);
  });

  it("locks body scroll and hides the rest of the page from assistive tech", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await openIt(user);
    expect(document.body.hasAttribute("data-scroll-locked")).toBe(true);
    expect(screen.getByText("Outside content").closest("[aria-hidden='true']")).not.toBeNull();
  });

  it("focuses Close by default when there is no initialFocus", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await openIt(user);
    expect(screen.getByRole("button", { name: "Close sign in" })).toHaveFocus();
  });

  it("returns focus to returnFocusTo instead of the opener when given", async () => {
    const user = userEvent.setup();
    render(<Harness returnToFallback />);
    await openIt(user);
    await user.keyboard("{Escape}");
    expect(screen.getByRole("button", { name: "Fallback" })).toHaveFocus();
  });

  it("renders the count after the title", async () => {
    const user = userEvent.setup();
    render(<Harness count="3 items" />);
    await user.click(screen.getByRole("button", { name: "Open sign in" }));
    expect(screen.getByRole("heading", { name: /Sign in/ }).textContent).toBe("Sign in 3 items");
    // The accessible name reads as words, not "Sign in3 items".
    expect(screen.getByRole("dialog", { name: "Sign in 3 items" })).toBeInTheDocument();
  });

  it("renders the footer under the body", async () => {
    const user = userEvent.setup();
    render(<Harness footer={<button type="button">Pay</button>} />);
    await openIt(user);
    expect(document.querySelector(".sheet-foot")?.textContent).toBe("Pay");
  });

  it("variant=side gives .sheet--side, dialog gives .sheet--dialog", async () => {
    const user = userEvent.setup();
    const { unmount } = render(<Harness variant="side" />);
    const dialog = await openIt(user);
    expect(dialog.classList.contains("sheet-panel")).toBe(true);
    expect(dialog.classList.contains("sheet--side")).toBe(true);
    unmount();
    render(<Harness variant="dialog" />);
    expect((await openIt(user)).classList.contains("sheet--dialog")).toBe(true);
  });
});

describe("Overlay drag to dismiss", () => {
  beforeEach(() => {
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: query === "(max-width: 639px)" && phone.value,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }));
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
      height: 600,
    } as DOMRect);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    phone.value = true;
  });
  const phone = { value: true };

  /** Pointerdown on the head at y=0, move to 200, release 500ms later. */
  async function dragHead(target: (dialog: HTMLElement) => Element, onOpenChange = vi.fn()) {
    vi.useFakeTimers({ toFake: ["performance"] });
    render(<Harness onOpenChange={onOpenChange} />);
    // userEvent needs real timers; open with a plain click instead.
    fireEvent.click(screen.getByRole("button", { name: "Open sign in" }));
    const dialog = await screen.findByRole("dialog", { name: "Sign in" });
    const el = target(dialog);
    fireEvent.pointerDown(el, { pointerId: 1, button: 0, clientY: 0 });
    fireEvent.pointerMove(el, { pointerId: 1, clientY: 200 });
    const moved = dialog.style.transform;
    vi.advanceTimersByTime(500);
    fireEvent.pointerUp(el, { pointerId: 1, clientY: 200 });
    return { onOpenChange, moved };
  }

  it("a 200px drag of the head in 500ms follows the finger, then dismisses at 600px high", async () => {
    const { onOpenChange, moved } = await dragHead(
      (d) => d.querySelector(".sheet-head") as Element,
    );
    expect(moved).toBe("translateY(200px)");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("a short slow drag snaps back and keeps the sheet open", async () => {
    vi.useFakeTimers({ toFake: ["performance"] });
    const onOpenChange = vi.fn();
    render(<Harness onOpenChange={onOpenChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Open sign in" }));
    const dialog = await screen.findByRole("dialog", { name: "Sign in" });
    const head = dialog.querySelector(".sheet-head") as Element;
    fireEvent.pointerDown(head, { pointerId: 1, button: 0, clientY: 0 });
    fireEvent.pointerMove(head, { pointerId: 1, clientY: 100 });
    vi.advanceTimersByTime(1000);
    fireEvent.pointerUp(head, { pointerId: 1, clientY: 100 });
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(dialog.style.transform).toBe("");
    // The class stays while open, so the entrance animation is never re-armed.
    expect(dialog.classList.contains("is-dragging")).toBe(true);
  });

  it("a lost pointer capture snaps back instead of leaving the sheet stuck mid-drag", async () => {
    vi.useFakeTimers({ toFake: ["performance"] });
    const onOpenChange = vi.fn();
    render(<Harness onOpenChange={onOpenChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Open sign in" }));
    const dialog = await screen.findByRole("dialog", { name: "Sign in" });
    const head = dialog.querySelector(".sheet-head") as Element;
    fireEvent.pointerDown(head, { pointerId: 1, button: 0, clientY: 0 });
    fireEvent.pointerMove(head, { pointerId: 1, clientY: 400 });
    fireEvent.lostPointerCapture(head, { pointerId: 1, clientY: 400 });
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(dialog.style.transform).toBe("");
  });

  it("puts the drag handlers on the head only, not the panel or the body", async () => {
    vi.useFakeTimers({ toFake: ["performance"] });
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Open sign in" }));
    const dialog = await screen.findByRole("dialog", { name: "Sign in" });
    const body = dialog.querySelector(".sheet-body") as Element;
    fireEvent.pointerDown(body, { pointerId: 1, button: 0, clientY: 0 });
    fireEvent.pointerMove(body, { pointerId: 1, clientY: 200 });
    expect(dialog.style.transform).toBe("");
    expect(dialog.classList.contains("is-dragging")).toBe(false);
  });

  it("a pointerdown on Close does not start a drag", async () => {
    const { onOpenChange, moved } = await dragHead(
      (d) => d.querySelector("button[aria-label='Close sign in']") as Element,
    );
    expect(moved).toBe("");
    // The fake pointerup is not a click, so nothing closed it either.
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("is inactive above 639px", async () => {
    phone.value = false;
    const { onOpenChange, moved } = await dragHead(
      (d) => d.querySelector(".sheet-head") as Element,
    );
    expect(moved).toBe("");
    expect(onOpenChange).not.toHaveBeenCalled();
  });
});
