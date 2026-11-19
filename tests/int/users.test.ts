import { ObjectId } from "mongodb";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  USERS_COLLECTION,
  findOrCreateUserByIdentifier,
  findUserByIdentifier,
  getUserById,
  setUserRole,
  toPublicUser,
  type UserConsents,
  type UserDoc,
} from "@/server/auth/users";
import { SESSIONS_COLLECTION, createSession, resolveSession } from "@/server/auth/sessions";
import { getDb } from "@/server/db/client";
import { ensureIndexes } from "@/server/db/indexes";
import "@/server/db/register-all.ts";
import { clearCollections, startMemoryReplSet, stopMemoryReplSet } from "../helpers/mongo";

beforeAll(async () => {
  await startMemoryReplSet();
  await ensureIndexes(await getDb());
}, 120_000);
afterAll(stopMemoryReplSet);
beforeEach(async () => {
  await clearCollections(USERS_COLLECTION, SESSIONS_COLLECTION);
});

const T = new Date("2026-11-17T04:30:00Z");
const H = 3_600_000;
const phone = { channel: "phone", value: "+919876543210" } as const;
const email = { channel: "email", value: "a@example.com" } as const;

describe("findOrCreateUserByIdentifier", () => {
  it("rejects a channel outside the fixed table and creates nothing", async () => {
    for (const channel of ["role", "$where", "__proto__"]) {
      await expect(
        findOrCreateUserByIdentifier({ channel, value: "x" } as never, T),
      ).rejects.toThrow("unsupported channel");
    }
    expect(await (await getDb()).collection(USERS_COLLECTION).countDocuments()).toBe(0);
  });

  it.each([
    ["phone", phone, "phoneVerifiedAt"],
    ["email", email, "emailVerifiedAt"],
  ] as const)("creates then finds by %s", async (_n, ident, verified) => {
    const a = await findOrCreateUserByIdentifier(ident, T);
    expect(a.created).toBe(true);
    expect(a.user).toMatchObject({ role: "customer", [verified]: T, [ident.channel]: ident.value });
    const later = new Date(T.getTime() + H);
    const b = await findOrCreateUserByIdentifier(ident, later);
    expect(b.created).toBe(false);
    expect(b.user._id).toEqual(a.user._id);
    expect(b.user[verified]).toEqual(T);
    expect(b.user.lastLoginAt).toEqual(later);
  });

  it("creates one user for ten parallel calls", async () => {
    const rs = await Promise.all(
      Array.from({ length: 10 }, () => findOrCreateUserByIdentifier(email, T)),
    );
    const db = await getDb();
    expect(await db.collection(USERS_COLLECTION).countDocuments({ email: email.value })).toBe(1);
    expect(new Set(rs.map((r) => r.user._id.toHexString())).size).toBe(1);
    expect(rs.filter((r) => r.created)).toHaveLength(1);
  });

  it("getUserById returns the user, or null", async () => {
    const { user } = await findOrCreateUserByIdentifier(phone, T);
    expect(await getUserById(user._id)).toMatchObject({ phone: phone.value });
    expect(await getUserById(new ObjectId())).toBeNull();
  });

  it("writes the sign-up name and consents on insert only", async () => {
    const consents: UserConsents = {
      channel: "email",
      termsPrivacy: { version: "2026-11-17", at: T },
      adult: { at: T },
      marketing: { optedIn: false, at: T },
    };
    const a = await findOrCreateUserByIdentifier(email, T, { name: "Asha Rao", consents });
    expect(a.created).toBe(true);
    expect(a.user).toMatchObject({ name: "Asha Rao", consents });

    const later = new Date(T.getTime() + H);
    const b = await findOrCreateUserByIdentifier(email, later, {
      name: "Someone Else",
      consents: { ...consents, marketing: { optedIn: true, at: later } },
    });
    expect(b.created).toBe(false);
    expect(b.user.name).toBe("Asha Rao");
    expect(b.user.consents).toEqual(consents);
    expect(b.user.lastLoginAt).toEqual(later);
  });
});

describe("findUserByIdentifier", () => {
  it("finds by the verified identifier and never creates", async () => {
    expect(await findUserByIdentifier(phone)).toBeNull();
    expect(await (await getDb()).collection(USERS_COLLECTION).countDocuments()).toBe(0);
    const { user } = await findOrCreateUserByIdentifier(phone, T);
    expect((await findUserByIdentifier(phone))?._id).toEqual(user._id);
    expect(await findUserByIdentifier(email)).toBeNull();
  });

  it("rejects a channel outside the fixed table", async () => {
    await expect(findUserByIdentifier({ channel: "$where", value: "x" } as never)).rejects.toThrow(
      "unsupported channel",
    );
  });
});

describe("toPublicUser", () => {
  it("maps a phone user", async () => {
    const { user } = await findOrCreateUserByIdentifier(phone, T);
    expect(toPublicUser(user)).toEqual({
      id: user._id.toHexString(),
      phone: "+919876543210",
      email: null,
      role: "customer",
      name: null,
    });
  });

  it("includes the sign-up name", () => {
    const user = { _id: new ObjectId(), email: email.value, role: "customer", name: "Asha Rao" };
    expect(toPublicUser(user as UserDoc).name).toBe("Asha Rao");
  });
});

describe("setUserRole", () => {
  it("changes the role and revokes all of that user's sessions only", async () => {
    const { user } = await findOrCreateUserByIdentifier(phone, T);
    const other = (await findOrCreateUserByIdentifier(email, T)).user;
    const s1 = await createSession(user, T);
    const s2 = await createSession(user, T);
    const keep = await createSession(other, T);

    expect(await setUserRole(user._id, "pharmacist", T)).toBe(true);
    expect((await getUserById(user._id))!.role).toBe("pharmacist");
    expect(await resolveSession(s1.token, T)).toBeNull();
    expect(await resolveSession(s2.token, T)).toBeNull();
    expect(await resolveSession(keep.token, T)).not.toBeNull();
    expect(await setUserRole(new ObjectId(), "admin", T)).toBe(false);
  });
});
