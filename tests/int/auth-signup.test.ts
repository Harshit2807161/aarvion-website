import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { POST as SEND } from "@/app/api/auth/otp/send/route";
import { POST as VERIFY } from "@/app/api/auth/otp/verify/route";
import { OTP_COLLECTION } from "@/server/auth/otp";
import { SESSIONS_COLLECTION } from "@/server/auth/sessions";
import { USERS_COLLECTION, type UserDoc } from "@/server/auth/users";
import { getDb } from "@/server/db/client";
import { resetDepsForTests } from "@/server/deps";
import "@/server/db/register-all.ts";
import { resetEnvForTests } from "@/server/env";
import { OUTBOX_COLLECTION } from "@/server/providers/outbox";
import { RATE_LIMITS_COLLECTION } from "@/server/security/rate-limit";
import { installClock } from "../helpers/clock";
import { jsonPost, sessionTokenFrom } from "../helpers/http";
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
