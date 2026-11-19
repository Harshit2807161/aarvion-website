import { connection } from "next/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { POST as SEND } from "@/app/api/auth/otp/send/route";
import { POST as VERIFY } from "@/app/api/auth/otp/verify/route";
import { GET as SESSION } from "@/app/api/auth/session/route";
import { OTP_COLLECTION } from "@/server/auth/otp";
import { SESSIONS_COLLECTION, createSession } from "@/server/auth/sessions";
import { USERS_COLLECTION, type UserDoc } from "@/server/auth/users";
import { getDb } from "@/server/db/client";
import { resetDepsForTests } from "@/server/deps";
import "@/server/db/register-all.ts";
import { resetEnvForTests } from "@/server/env";
import { OUTBOX_COLLECTION } from "@/server/providers/outbox";
import { RATE_LIMITS_COLLECTION } from "@/server/security/rate-limit";
import { installClock } from "../helpers/clock";
import { getReq, jsonPost, sessionTokenFrom } from "../helpers/http";
import { clearCollections, startMemoryReplSet, stopMemoryReplSet } from "../helpers/mongo";
import { lastOtpCode } from "../helpers/otp";

const ASHA = "asha@example.com";
const T = new Date("2026-11-17T04:30:00Z");
const AUDIT = "audit_logs";
const SIGNUP = { name: "Asha Rao", adult: true, termsPrivacy: true, marketing: false };
let clock: ReturnType<typeof installClock>;

beforeAll(async () => {
  vi.stubEnv("OTP_PEPPER", "x".repeat(64));
  resetEnvForTests();
  await startMemoryReplSet();
}, 120_000);
afterAll(async () => {
  resetDepsForTests();
  await stopMemoryReplSet();
  vi.unstubAllEnvs();
  resetEnvForTests();
});
beforeEach(async () => {
  vi.stubEnv("OTP_PEPPER", "x".repeat(64));
  resetEnvForTests();
  resetDepsForTests();
  clock = installClock(T.toISOString());
  await clearCollections(
    OTP_COLLECTION,
    RATE_LIMITS_COLLECTION,
    OUTBOX_COLLECTION,
    USERS_COLLECTION,
    SESSIONS_COLLECTION,
    AUDIT,
  );
});

type VerifyOpts = { identifier?: string; signup?: unknown; ip?: string };
const verify = (code: string, { identifier = ASHA, signup, ip }: VerifyOpts = {}) =>
  VERIFY(
    jsonPost(
      "/api/auth/otp/verify",
      { channel: "email", identifier, code, ...(signup === undefined ? {} : { signup }) },
      ip ? { ip } : {},
    ),
  );
const count = async (name: string) => (await getDb()).collection(name).countDocuments();
const users = async () => (await getDb()).collection<UserDoc>(USERS_COLLECTION);

async function sendAndRead(identifier = ASHA): Promise<string> {
  const res = await SEND(jsonPost("/api/auth/otp/send", { channel: "email", identifier }));
  expect(res.status).toBe(200);
  return lastOtpCode(identifier);
}

/** Attempts spent on the identifier's challenge, or undefined without one. */
async function attempts(identifier = ASHA): Promise<number | undefined> {
  const col = (await getDb()).collection<{ _id: string; attempts: number }>(OTP_COLLECTION);
  return (await col.findOne({ _id: `email:${identifier}` }))?.attempts;
}

describe("sign-up on OTP verify", () => {
  it("a first verify with sign-up creates the user with its name and consents", async () => {
    const ok = await verify(await sendAndRead(), { signup: SIGNUP });
    expect(ok.status).toBe(200);
    expect(sessionTokenFrom(ok)).not.toBeNull();
    expect(await ok.json()).toEqual({
      user: {
        id: expect.stringMatching(/^[0-9a-f]{24}$/),
        phone: null,
        email: ASHA,
        role: "customer",
        name: "Asha Rao",
      },
      isNewUser: true,
    });
    const user = await (await users()).findOne({ email: ASHA });
    expect(user?.name).toBe("Asha Rao");
    expect(user?.consents).toEqual({
      channel: "email",
      termsPrivacy: { version: "2026-11-17", at: T },
      adult: { at: T },
      marketing: { optedIn: false, at: T },
    });
    expect(await count(SESSIONS_COLLECTION)).toBe(1);
    expect(await count(AUDIT)).toBe(1);
  });

  it("an existing user logs in without sign-up, and a later sign-up changes nothing", async () => {
    expect((await verify(await sendAndRead(), { signup: SIGNUP })).status).toBe(200);
    const before = await (await users()).findOne({ email: ASHA });

    clock.advance(31_000);
    const plain = await verify(await sendAndRead());
    expect(plain.status).toBe(200);
    expect(await plain.json()).toMatchObject({ isNewUser: false, user: { name: "Asha Rao" } });

    clock.advance(31_000);
    const other = { ...SIGNUP, name: "Xavier", marketing: true };
    const again = await verify(await sendAndRead(), { signup: other });
    expect(again.status).toBe(200);
    expect(await again.json()).toMatchObject({ isNewUser: false, user: { name: "Asha Rao" } });
    const after = await (await users()).findOne({ email: ASHA });
    expect(after?.name).toBe("Asha Rao");
    expect(after?.consents).toEqual(before?.consents);
    expect(after?.consents?.marketing).toEqual({ optedIn: false, at: T });
  });

  it("stores a new user's marketing opt-in as given", async () => {
    const identifier = "meera@example.com";
    const signup = { ...SIGNUP, name: "Meera Iyer", marketing: true };
    expect((await verify(await sendAndRead(identifier), { identifier, signup })).status).toBe(200);
    const user = await (await users()).findOne({ email: identifier });
    expect(user?.consents?.marketing).toEqual({ optedIn: true, at: T });
  });

  it("accepts real names in Latin and Devanagari", async () => {
    for (const [identifier, name] of [
      ["ravi@example.com", "Ravi Kumar"],
      ["priya@example.com", "प्रिया शर्मा"],
    ] as const) {
      const res = await verify(await sendAndRead(identifier), {
        identifier,
        signup: { ...SIGNUP, name },
      });
      expect(res.status).toBe(200);
      expect((await (await users()).findOne({ email: identifier }))?.name).toBe(name);
    }
  });

  it("until 38c, a first verify without sign-up creates a user with no name or consents", async () => {
    // Pins today's interim behaviour; 38c changes this to 409 signup_required.
    const res = await verify(await sendAndRead());
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ isNewUser: true, user: { email: ASHA, name: null } });
    const user = await (await users()).findOne({ email: ASHA });
    expect(user).not.toHaveProperty("name");
    expect(user).not.toHaveProperty("consents");
  });

  it("400 invalid_request for a sign-up without the required consents or a real name", async () => {
    const code = await sendAndRead();
    const without = (key: string) =>
      Object.fromEntries(Object.entries(SIGNUP).filter(([k]) => k !== key));
    const bad = [
      { ...SIGNUP, adult: false },
      { ...SIGNUP, termsPrivacy: false },
      without("termsPrivacy"),
      without("marketing"),
      { ...SIGNUP, marketing: "yes" },
      { ...SIGNUP, name: "A" },
      { ...SIGNUP, name: "   A   " },
      { ...SIGNUP, name: "12345" },
      { ...SIGNUP, name: "x".repeat(81) },
      // Control and format characters: they hide or reorder text in staff views and emails.
      { ...SIGNUP, name: "\u200BA\u200B" },
      { ...SIGNUP, name: "Asha \u202ERao" },
      { ...SIGNUP, name: "Asha\nRao" },
      { ...SIGNUP, role: "admin" },
      "Asha Rao",
    ];
    for (const signup of bad) {
      const res = await verify(code, { signup });
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: "invalid_request" });
    }
    expect(await attempts()).toBe(0);
    expect(await count(USERS_COLLECTION)).toBe(0);

    // The name is stored trimmed.
    const ok = await verify(code, { signup: { ...SIGNUP, name: "  Asha Rao  " } });
    expect(ok.status).toBe(200);
    expect((await (await users()).findOne({ email: ASHA }))?.name).toBe("Asha Rao");
  });
});

describe("GET /api/auth/session", () => {
  const session = (token?: string) =>
    SESSION(getReq("/api/auth/session", token ? { cookie: `__Host-aarv_sid=${token}` } : {}));

  it("is 200 { user: null }, uncached, without a usable session (never 401)", async () => {
    for (const token of [undefined, "B".repeat(43), "not-a-token"]) {
      const res = await session(token);
      expect(res.status).toBe(200);
      expect(res.headers.get("cache-control")).toBe("no-store");
      expect(res.headers.get("set-cookie")).toBeNull();
      expect(await res.json()).toEqual({ user: null });
    }
  });

  it("returns the public user after a login, slides the cookie, and is null once revoked", async () => {
    const token = sessionTokenFrom(await verify(await sendAndRead(), { signup: SIGNUP }))!;
    const res = await session(token);
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(res.headers.get("set-cookie")).toBeNull();
    expect(await res.json()).toEqual({
      user: {
        id: expect.stringMatching(/^[0-9a-f]{24}$/),
        phone: null,
        email: ASHA,
        role: "customer",
        name: "Asha Rao",
      },
    });

    clock.advance(2 * 60_000);
    expect((await session(token)).headers.get("set-cookie")).toBe(
      `__Host-aarv_sid=${token}; Path=/; Max-Age=2592000; Secure; HttpOnly; SameSite=Lax`,
    );

    await (await getDb()).collection(SESSIONS_COLLECTION).deleteMany({});
    expect(await (await session(token)).json()).toEqual({ user: null });
  });

  it("is 200 { user: null } once the session has expired", async () => {
    const token = sessionTokenFrom(await verify(await sendAndRead(), { signup: SIGNUP }))!;
    clock.advance(30 * 86_400_000 + 1); // past the customer's 30-day idle window
    const res = await session(token);
    expect(res.status).toBe(200);
    expect(res.headers.get("set-cookie")).toBeNull();
    expect(await res.json()).toEqual({ user: null });
    expect(await count(SESSIONS_COLLECTION)).toBe(0);
  });

  it("never re-issues a staff session's cookie", async () => {
    const { insertedId } = await (
      await users()
    ).insertOne({
      email: "pharm@example.com",
      role: "pharmacist",
      createdAt: T,
      updatedAt: T,
      lastLoginAt: T,
    } as UserDoc);
    const { token } = await createSession({ _id: insertedId, role: "pharmacist" }, T);
    clock.advance(2 * 60_000);
    const res = await session(token);
    expect(((await res.json()) as { user: { role: string } }).user.role).toBe("pharmacist");
    expect(res.headers.get("set-cookie")).toBeNull();
  });

  it("calls connection() before any read and rethrows Next's prerender abort", async () => {
    const abort = Object.assign(new Error("prerender"), { digest: "HANGING_PROMISE_REJECTION" });
    vi.mocked(connection).mockRejectedValueOnce(abort);
    const { Collection } = await import("mongodb");
    const read = vi.spyOn(Collection.prototype, "findOne");
    try {
      await expect(session("B".repeat(43))).rejects.toBe(abort);
      expect(read).not.toHaveBeenCalled();
    } finally {
      read.mockRestore();
    }
  });
});
