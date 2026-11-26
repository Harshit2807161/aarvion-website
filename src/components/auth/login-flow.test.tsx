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

const calls = (url: string) => posted.filter((p) => p.url === url);
const button = (name: string) => screen.queryByRole("button", { name });

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
