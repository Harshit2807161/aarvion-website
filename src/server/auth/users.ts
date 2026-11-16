import { ObjectId } from "mongodb";
import { getDb } from "../db/client.ts";
import { registerIndexes } from "../db/indexes.ts";
import type { Identifier } from "./identifier.ts";
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

export type UserDoc = {
  _id: ObjectId;
  phone?: string;
  email?: string;
  phoneVerifiedAt?: Date;
  emailVerifiedAt?: Date;
  role: Role;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt: Date;
};

export type PublicUser = { id: string; phone: string | null; email: string | null; role: Role };

export function toPublicUser(u: UserDoc): PublicUser {
  return { id: u._id.toHexString(), phone: u.phone ?? null, email: u.email ?? null, role: u.role };
}

async function users() {
  return (await getDb()).collection<UserDoc>(USERS_COLLECTION);
}

/** Fixed channel -> user field tables: the caller's string is never used as a field name. */
const IDENTIFIER_FIELD = { phone: "phone", email: "email" } as const;
const VERIFIED_FIELD = { phone: "phoneVerifiedAt", email: "emailVerifiedAt" } as const;

/** Atomic find-or-create keyed on the verified identifier; first verification time is kept. */
export async function findOrCreateUserByIdentifier(
  id: Identifier,
  now: Date,
): Promise<{ user: UserDoc; created: boolean }> {
  const col = await users();
  if (!Object.hasOwn(IDENTIFIER_FIELD, id.channel)) throw new Error("unsupported channel");
  const field = IDENTIFIER_FIELD[id.channel];
  const verifiedField = VERIFIED_FIELD[id.channel];
  const run = () =>
    col.findOneAndUpdate(
      { [field]: id.value },
      {
        $setOnInsert: { role: "customer", createdAt: now },
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
