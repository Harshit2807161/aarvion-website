import { type ReactElement, isValidElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LoginFlow } from "@/components/auth/login-flow";

const guard = vi.hoisted(() => ({ forbidden: true }));
vi.mock("next/server", () => ({ connection: vi.fn(async () => {}) }));
vi.mock("@/server/providers/guard", () => ({ isMockForbidden: () => guard.forbidden }));

import LoginPage, { metadata, viewport } from "./page";

type El = ReactElement<{ children?: unknown; [k: string]: unknown }>;

/** The first element in the tree whose type passes `match`. */
function find(node: unknown, match: (type: unknown) => boolean): El | null {
  if (Array.isArray(node)) {
    for (const n of node) {
      const hit = find(n, match);
      if (hit) return hit;
    }
    return null;
  }
  if (!isValidElement(node)) return null;
  const el = node as El;
  if (match(el.type)) return el;
  return find(el.props.children, match);
}

/** Renders the request-time card (the async component inside the Suspense) and returns its LoginFlow. */
async function loginFlowProps() {
  const card = find(LoginPage(), (t) => typeof t === "function" && t.name === "LoginCard");
  expect(card).not.toBeNull();
  const flow = (await (card!.type as () => Promise<El>)()) as El;
  expect(flow.type).toBe(LoginFlow);
  return flow.props;
}

describe("/login page", () => {
  beforeEach(() => {
    guard.forbidden = true;
  });

  it("never allows the demo states where mocks are forbidden (production)", async () => {
    expect(await loginFlowProps()).toMatchObject({ mode: "page", allowDemo: false });
  });

  it("allows them where mocks are allowed (dev, preview, the e2e build)", async () => {
    guard.forbidden = false;
    expect(await loginFlowProps()).toMatchObject({ mode: "page", allowDemo: true });
  });

  it("is noindex and lets the keyboard resize the page", () => {
    expect(metadata).toMatchObject({ title: "Sign in", robots: { index: false } });
    expect(viewport).toMatchObject({ interactiveWidget: "resizes-content" });
  });
});
