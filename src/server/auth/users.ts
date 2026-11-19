import { ObjectId } from "mongodb";
import { getDb } from "../db/client.ts";
import { registerIndexes } from "../db/indexes.ts";
import type { Channel, Identifier } from "./identifier.ts";
import type { Role } from "./roles.ts";
import { revokeUserSessions } from "./sessions.ts";

export const USERS_COLLECTION = "users";

registerIndexes(USERS_COLLECTION, [
  {
    key: { phone: 1 },
    name: "phone_unique",
    unique: true,
    partialFilterExpression: { phone: { $type: "string" } },
  },
  {
    key: { email: 1 },
    name: "email_unique",
    unique: true,
    partialFilterExpression: { email: { $type: "string" } },
  },
]);

export { STAFF_ROLES, type Role, type StaffRole } from "./roles.ts";

/**
 * The consent record a sign-up stores (DPDP): which policy version was accepted, when, and on
 * which OTP channel the person was verified. Written once, on insert; a later login never
 * overwrites it.
 */
export type UserConsents = {
  channel: Channel;
  termsPrivacy: { version: string; at: Date };
  adult: { at: Date };
  marketing: { optedIn: boolean; at: Date };
};

export type UserDoc = {
  _id: ObjectId;
  phone?: string;
  email?: string;
  phoneVerifiedAt?: Date;
  emailVerifiedAt?: Date;
  /** Absent on users created before sign-up consent existed, and on staff inserted by hand. */
  name?: string;
  consents?: UserConsents;
  role: Role;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt: Date;
};

export type PublicUser = {
  id: string;
  phone: string | null;
  email: string | null;
  role: Role;
  name: string | null;
};

export function toPublicUser(u: UserDoc): PublicUser {
  return {
    id: u._id.toHexString(),
    phone: u.phone ?? null,
    email: u.email ?? null,
    role: u.role,
    name: u.name ?? null,
  };
}

async function users() {
  return (await getDb()).collection<UserDoc>(USERS_COLLECTION);
}

/** Fixed channel -> user field tables: the caller's string is never used as a field name. */
const IDENTIFIER_FIELD = { phone: "phone", email: "email" } as const;
const VERIFIED_FIELD = { phone: "phoneVerifiedAt", email: "emailVerifiedAt" } as const;

function identifierField(id: Identifier) {
  if (!Object.hasOwn(IDENTIFIER_FIELD, id.channel)) throw new Error("unsupported channel");
  return IDENTIFIER_FIELD[id.channel];
}

/**
 * The filter for an identifier. `$type: "string"` matches the unique indexes' partial filter, so
 * the planner can use them; a plain `{ email: x }` is a collection scan, whose cost would differ
 * for known and unknown identifiers. An upsert still inserts the field from `$eq`.
 */
function identifierFilter(id: Identifier) {
  return { [identifierField(id)]: { $eq: id.value, $type: "string" } };
}

/** The user holding this verified identifier, or null. Index-backed (see identifierFilter). */
export async function findUserByIdentifier(id: Identifier): Promise<UserDoc | null> {
  return (await users()).findOne(identifierFilter(id));
}

/**
 * Atomic find-or-create keyed on the verified identifier; first verification time is kept.
 * `signup` (name and consents) goes in `$setOnInsert` only: an existing user's never change.
 */
export async function findOrCreateUserByIdentifier(
  id: Identifier,
  now: Date,
  signup?: { name: string; consents: UserConsents },
): Promise<{ user: UserDoc; created: boolean }> {
  const col = await users();
  const filter = identifierFilter(id);
  const verifiedField = VERIFIED_FIELD[id.channel];
  const onInsert = signup ? { name: signup.name, consents: signup.consents } : {};
  const run = () =>
    col.findOneAndUpdate(
      filter,
      {
        $setOnInsert: { role: "customer", createdAt: now, ...onInsert },
        $min: { [verifiedField]: now },
        $set: { lastLoginAt: now, updatedAt: now },
      },
      { upsert: true, returnDocument: "after", includeResultMetadata: true },
    );
  let res;
  try {
    res = await run();
  } catch (err) {
    // Two racing upserts can both try to insert; the loser retries and finds the winner's row.
    if ((err as { code?: number }).code !== 11000) throw err;
    res = await run();
  }
  const user = res.value;
  if (!user) throw new Error("findOrCreateUserByIdentifier: upsert returned no document");
  return { user, created: res.lastErrorObject?.updatedExisting === false };
}

export async function getUserById(id: ObjectId): Promise<UserDoc | null> {
  return (await users()).findOne({ _id: id });
}

/** Changes a role and revokes every session of that user, so the new role needs a fresh login. */
export async function setUserRole(userId: ObjectId, role: Role, now: Date): Promise<boolean> {
  const res = await (await users()).updateOne({ _id: userId }, { $set: { role, updatedAt: now } });
  if (res.matchedCount !== 1) return false;
  await revokeUserSessions(userId);
  return true;
}
