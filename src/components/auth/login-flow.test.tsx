import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { findClaims } from "../../../tests/helpers/claims";
import { routerSpies } from "../../../tests/helpers/navigation-mocks";
import { LoginFlow } from "./login-flow";
import { LOGIN_COPY } from "./login-machine";

/**
 * The /login flow's id and code steps against a fetch mocked by URL. Each endpoint answers from
 * its queue of replies (the last one repeats); a reply can be a promise, so a test can hold a
 * request open. Timers and Date are fake, so countdowns are exact.
 */
type Reply = { status: number; body: unknown };
const SEND = "/api/auth/otp/send";
const VERIFY = "/api/auth/otp/verify";
const SESSION = "/api/auth/session";
const SIGNED_OUT: Reply = { status: 401, body: { error: "unauthenticated" } };
const SENT: Reply = { status: 200, body: { ok: true } };
const WRONG: Reply = { status: 400, body: { error: "invalid_code" } };
const OK: Reply = { status: 200, body: { ok: true, isNewUser: false, user: { name: "Asha Rao" } } };

let replies: Record<string, (Reply | Promise<Reply>)[]>;
let posted: { url: string; body: Record<string, unknown> }[];

function reply(url: string, ...r: (Reply | Promise<Reply>)[]) {
  replies[url] = r;
}

function held(): { promise: Promise<Reply>; resolve: (r: Reply) => void } {
  let resolve!: (r: Reply) => void;
  const promise = new Promise<Reply>((res) => (resolve = res));
  return { promise, resolve };
}

beforeEach(() => {
  vi.useFakeTimers({ now: new Date("2026-11-26T10:00:00Z") });
  posted = [];
  replies = { [SEND]: [SENT], [VERIFY]: [WRONG], [SESSION]: [SIGNED_OUT] };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.body) posted.push({ url, body: JSON.parse(String(init.body)) });
      const queue = replies[url] ?? [];
      const r = await (queue.length > 1 ? queue.shift()! : queue[0]!);
      return { status: r.status, ok: r.status < 300, json: async () => r.body };
    }),
  );
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

/** Lets the mocked fetch and the state updates after it settle. */
async function flush() {
  await act(async () => {
    for (let i = 0; i < 10; i++) await Promise.resolve();
  });
}

async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

const calls = (url: string) => posted.filter((p) => p.url === url);
const otp = () => document.querySelector<HTMLInputElement>("#pg-otp")!;
const button = (name: string) => screen.queryByRole("button", { name });

function paste(text: string) {
  fireEvent.paste(otp(), { clipboardData: { getData: () => text } });
}

function type(value: string) {
  fireEvent.change(otp(), { target: { value } });
}

async function toCodeStep(raw = "+91 98765 43210") {
  const view = render(<LoginFlow mode="page" />);
  await flush();
  fireEvent.change(screen.getByLabelText(LOGIN_COPY.mobileLabel), { target: { value: raw } });
  fireEvent.click(button(LOGIN_COPY.send)!);
  await flush();
  return view;
}

describe("LoginFlow: id step", () => {
  it("posts exactly the validated identifier, then leaves the id step", async () => {
    const { container } = await toCodeStep();
    expect(calls(SEND)).toEqual([
      { url: SEND, body: { channel: "phone", identifier: "9876543210" } },
    ]);
    expect(container.querySelector('[data-step="id"]')).toBeNull();
  });

  it("keeps the raw mobile input unlimited and wires the numeric keyboard", async () => {
    render(<LoginFlow mode="page" />);
    const input = screen.getByLabelText(LOGIN_COPY.mobileLabel);
    expect(input.hasAttribute("maxlength")).toBe(false);
    expect(input.getAttribute("inputmode")).toBe("numeric");
    expect(input.getAttribute("autocomplete")).toBe("tel-national");
    expect(document.querySelector(".prefix")!.textContent).toBe("+91");
  });

  it("posts a trimmed, lower-case email", async () => {
    render(<LoginFlow mode="page" />);
    fireEvent.click(screen.getByLabelText(LOGIN_COPY.email));
    const input = screen.getByLabelText(LOGIN_COPY.emailLabel);
    expect(input.getAttribute("autocomplete")).toBe("email");
    fireEvent.change(input, { target: { value: "  Asha@Example.COM " } });
    fireEvent.click(button(LOGIN_COPY.send)!);
    await flush();
    expect(calls(SEND)[0]!.body).toEqual({ channel: "email", identifier: "asha@example.com" });
  });

  it("a bad number shows one alert on the field and posts nothing", async () => {
    render(<LoginFlow mode="page" />);
    fireEvent.change(screen.getByLabelText(LOGIN_COPY.mobileLabel), { target: { value: "12345" } });
    fireEvent.click(button(LOGIN_COPY.send)!);
    await flush();
    const alerts = screen.getAllByRole("alert");
    expect(alerts).toHaveLength(1);
    expect(alerts[0]!.textContent).toBe(LOGIN_COPY.mobileInvalid);
    expect(calls(SEND)).toHaveLength(0);
  });

  it("while sending, Send shows the busy copy and a second click posts nothing", async () => {
    const send = held();
    reply(SEND, send.promise);
    render(<LoginFlow mode="page" />);
    fireEvent.change(screen.getByLabelText(LOGIN_COPY.mobileLabel), {
      target: { value: "9876543210" },
    });
    fireEvent.click(button(LOGIN_COPY.send)!);
    await flush();
    const busy = button(LOGIN_COPY.sending)!;
    expect(busy.getAttribute("aria-busy")).toBe("true");
    fireEvent.click(busy);
    await flush();
    expect(calls(SEND)).toHaveLength(1);
    send.resolve(SENT);
    await flush();
    expect(calls(SEND)).toHaveLength(1);
    expect(document.querySelector('[data-step="id"]')).toBeNull();
  });

  it("adds no live region of its own and makes no banned claims", async () => {
    const { container } = render(<LoginFlow mode="page" />);
    await flush();
    expect(container.querySelectorAll("[aria-live], [role=status]")).toHaveLength(0);
    expect(findClaims(container.textContent ?? "")).toEqual([]);
  });
});

describe("LoginFlow: code step", () => {
  it("shows where the code went and counts down to Send a new code", async () => {
    const { container } = await toCodeStep();
    expect(container.textContent).toContain("+91 98765 43210");
    expect(container.querySelector(".otp-timer")!.textContent).toBe("Resend code in 0:30");
    expect(button(LOGIN_COPY.resend)).toBeNull();
    await advance(30_000);
    expect(button(LOGIN_COPY.resend)).not.toBeNull();
  });

  it("adds no live region of its own and makes no banned claims", async () => {
    const { container } = await toCodeStep();
    expect(container.querySelectorAll("[aria-live], [role=status]")).toHaveLength(0);
    expect(findClaims(container.textContent ?? "")).toEqual([]);
  });

  it("sends at most one verify, never resends a rejected code, and takes an autofill", async () => {
    const first = held();
    reply(VERIFY, first.promise, WRONG, WRONG, OK);
    await toCodeStep();

    // A pasted code verifies on its own; Verify clicked while it is pending sends nothing more.
    paste("111111");
    await flush();
    fireEvent.click(button(LOGIN_COPY.verifying)!);
    fireEvent.submit(otp().form!);
    await flush();
    expect(calls(VERIFY)).toHaveLength(1);
    first.resolve(WRONG);
    await flush();
    expect(document.querySelector(".auth-alert")!.textContent).toBe(LOGIN_COPY.wrong(4));

    // The same rejected code, typed again, is not resubmitted.
    type("11111");
    type("111111");
    fireEvent.click(button(LOGIN_COPY.verify)!);
    await flush();
    expect(calls(VERIFY)).toHaveLength(1);

    // Android SMS autofill over a partial value sends the whole code once.
    type("12");
    const ev = new InputEvent("beforeinput", {
      inputType: "insertText",
      data: "482913",
      cancelable: true,
      bubbles: true,
    });
    act(() => {
      otp().dispatchEvent(ev);
    });
    await flush();
    expect(calls(VERIFY)).toHaveLength(2);
    expect(calls(VERIFY)[1]!.body).toEqual({
      channel: "phone",
      identifier: "9876543210",
      code: "482913",
    });
  });

  it("five wrong codes lock the field, hide Verify and count down to a new code", async () => {
    await toCodeStep();
    for (let i = 1; i <= 5; i++) {
      paste(`${i}${i}${i}${i}${i}${i}`);
      await flush();
    }
    expect(calls(VERIFY)).toHaveLength(5);
    expect(document.querySelector(".auth-alert")!.textContent).toMatch(
      /^Too many wrong codes, so this code no longer works\. You can ask for a new one in 0:\d\d\.$/,
    );
    expect(button(LOGIN_COPY.verify)).toBeNull();
    expect(otp().disabled).toBe(true);
    await advance(30_000);
    expect(document.querySelector(".auth-alert")!.textContent).toBe(LOGIN_COPY.lockedReady);
    expect(button(LOGIN_COPY.resend)!.className).toContain("btn");
  });

  it("[C3] a network limit counts down live from lockedUntil", async () => {
    reply(VERIFY, { status: 429, body: { error: "rate_limited", retryAfterSec: 900 } }, WRONG);
    await toCodeStep();
    paste("111111");
    await flush();
    const alert = () => document.querySelector(".auth-alert")!.textContent;
    expect(alert()).toBe("Too many attempts from this network. Try again in 15:00.");
    expect(button(LOGIN_COPY.verify)).toBeNull();
    await advance(1_000);
    expect(alert()).toBe("Too many attempts from this network. Try again in 14:59.");
  });

  it("[C3] a network limit costs no try: once it lifts, a wrong code leaves 4 tries", async () => {
    reply(VERIFY, { status: 429, body: { error: "rate_limited", retryAfterSec: 60 } }, WRONG);
    await toCodeStep();
    paste("111111");
    await flush();
    await advance(60_000);
    expect(document.querySelector(".auth-alert")).toBeNull();
    expect(button(LOGIN_COPY.verify)).not.toBeNull();
    paste("222222");
    await flush();
    expect(document.querySelector(".auth-alert")!.textContent).toBe(LOGIN_COPY.wrong(4));
  });

  it("Send a new code posts the same identifier and restarts the timer", async () => {
    const { container } = await toCodeStep();
    await advance(30_000);
    fireEvent.click(button(LOGIN_COPY.resend)!);
    await flush();
    expect(calls(SEND)).toHaveLength(2);
    expect(calls(SEND)[1]!.body).toEqual({ channel: "phone", identifier: "9876543210" });
    expect(container.querySelector(".otp-timer")!.textContent).toBe("Resend code in 0:30");
  });
});

describe("LoginFlow: an existing session", () => {
  it("a signed-in visitor completes at once", async () => {
    reply(SESSION, { status: 200, body: { user: { name: "Asha Rao" } } });
    const onDone = vi.fn();
    render(<LoginFlow mode="dialog" onDone={onDone} />);
    await flush();
    expect(onDone).toHaveBeenCalledWith({ isNewUser: false, name: "Asha Rao" });
    expect(routerSpies.replace).not.toHaveBeenCalled();
  });
});
