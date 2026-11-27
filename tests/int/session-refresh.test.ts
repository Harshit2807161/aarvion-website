import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { SESSION_COOKIE, sessionCookieHeader } from "@/server/auth/cookie";
import { getAuth, sessionRefreshHeaders } from "@/server/auth/guards";
import { SESSIONS_COLLECTION } from "@/server/auth/sessions";
import { USERS_COLLECTION } from "@/server/auth/users";
import "@/server/db/register-all";
import { resetDepsForTests } from "@/server/deps";
import { getReq } from "../helpers/http";
import { installClock } from "../helpers/clock";
import { clearCollections, startMemoryReplSet, stopMemoryReplSet } from "../helpers/mongo";
import { signedIn } from "../helpers/session";

let clock: ReturnType<typeof installClock>;

beforeAll(async () => {
  await startMemoryReplSet();
}, 120_000);
afterAll(async () => {
  resetDepsForTests();
  await stopMemoryReplSet();
});
beforeEach(async () => {
  clock = installClock("2026-11-27T04:30:00Z");
  await clearCollections(USERS_COLLECTION, SESSIONS_COLLECTION);
});

describe("signedIn", () => {
  it("makes distinct customers with a working session cookie", async () => {
    const a = await signedIn();
    const b = await signedIn();
    expect(a.user._id.equals(b.user._id)).toBe(false);
    expect(a.user.role).toBe("customer");
    expect(a.cookie.startsWith(`${SESSION_COOKIE}=`)).toBe(true);
    const auth = await getAuth(getReq("/api/x", { cookie: a.cookie }), clock.now());
    expect(auth?.user._id.equals(a.user._id)).toBe(true);
    expect(auth?.session.kind).toBe("customer");
  });

  it("a staff role gives a staff-kind session", async () => {
    const s = await signedIn({ role: "admin" });
    const auth = await getAuth(getReq("/api/x", { cookie: s.cookie }), clock.now());
    expect(auth?.session.kind).toBe("staff");
    expect(auth?.user.role).toBe("admin");
  });

  it("the same phone is the same user", async () => {
    const a = await signedIn({ phone: "+919812345678" });
    const b = await signedIn({ phone: "+919812345678" });
    expect(a.user._id.equals(b.user._id)).toBe(true);
  });
});

describe("sessionRefreshHeaders", () => {
  it("sets the 30-day cookie for a customer session that slid", async () => {
    const { cookie } = await signedIn();
    clock.advance(2 * 60_000); // past the 60 s touch interval, so the session slides
    const auth = (await getAuth(getReq("/api/x", { cookie }), clock.now()))!;
    expect(auth.refreshed).toBe(true);
    const set = sessionRefreshHeaders(auth).get("set-cookie");
    expect(set).toBe(sessionCookieHeader(auth.token, "customer"));
    expect(set).toContain("Max-Age=2592000");
  });

  it("sets nothing when the session did not slide", async () => {
    const { cookie } = await signedIn();
    const auth = (await getAuth(getReq("/api/x", { cookie }), clock.now()))!;
    expect(auth.refreshed).toBe(false);
    expect(sessionRefreshHeaders(auth).get("set-cookie")).toBeNull();
  });

  it("sets nothing for a staff session, even when it slid", async () => {
    const { cookie } = await signedIn({ role: "admin" });
    clock.advance(2 * 60_000);
    const auth = (await getAuth(getReq("/api/x", { cookie }), clock.now()))!;
    expect(auth.refreshed).toBe(true);
    expect(sessionRefreshHeaders(auth).get("set-cookie")).toBeNull();
  });
});
