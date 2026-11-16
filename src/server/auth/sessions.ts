import { createHash, randomBytes } from "node:crypto";
import type { ObjectId } from "mongodb";
import { getDb } from "../db/client.ts";
import { registerIndexes } from "../db/indexes.ts";
import { STAFF_ROLES, type Role } from "./roles.ts";
import type { UserDoc } from "./users.ts";

export const SESSIONS_COLLECTION = "sessions";

registerIndexes(SESSIONS_COLLECTION, [
  { key: { expiresAt: 1 }, name: "expiresAt_ttl", expireAfterSeconds: 0 },
  { key: { userId: 1 }, name: "userId_1" },
]);

export type SessionKind = "customer" | "staff";

/** Fails closed: only an explicit staff role gets the staff (short, absolute-capped) policy. */
export function sessionKindForRole(role: Role): SessionKind {
  return (STAFF_ROLES as readonly string[]).includes(role) ? "staff" : "customer";
}

export const SESSION_POLICY = {
  customer: { idleMs: 2_592_000_000, absoluteMs: null },
  staff: { idleMs: 1_800_000, absoluteMs: 43_200_000 },
} as const;
export const SESSION_TOUCH_INTERVAL_MS = 60_000;

export type SessionDoc = {
  _id: string; // sha256(token) hex; the raw token is never stored
  userId: ObjectId;
  kind: SessionKind;
  createdAt: Date;
  lastSeenAt: Date;
  idleExpiresAt: Date;
  absoluteExpiresAt: Date | null;
  expiresAt: Date;
};

const plus = (d: Date, ms: number) => new Date(d.getTime() + ms);

async function sessions() {
  return (await getDb()).collection<SessionDoc>(SESSIONS_COLLECTION);
}

export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** expiresAt (the TTL field) is whichever deadline comes first. */
function earliest(idle: Date, absolute: Date | null): Date {
  return absolute === null || idle.getTime() <= absolute.getTime() ? idle : absolute;
}

export async function createSession(
  user: Pick<UserDoc, "_id" | "role">,
  now: Date,
): Promise<{ token: string; session: SessionDoc }> {
  const token = randomBytes(32).toString("base64url");
  const kind = sessionKindForRole(user.role);
  const policy = SESSION_POLICY[kind];
  const idleExpiresAt = plus(now, policy.idleMs);
  const absoluteExpiresAt = policy.absoluteMs === null ? null : plus(now, policy.absoluteMs);
  const session: SessionDoc = {
    _id: hashSessionToken(token),
    userId: user._id,
    kind,
    createdAt: now,
    lastSeenAt: now,
    idleExpiresAt,
    absoluteExpiresAt,
    expiresAt: earliest(idleExpiresAt, absoluteExpiresAt),
  };
  await (await sessions()).insertOne(session);
  return { token, session };
}

/** Valid sessions are touched at most once per minute (sliding idle window). */
export async function resolveSession(
  token: string,
  now: Date,
): Promise<{ session: SessionDoc; refreshed: boolean } | null> {
  const col = await sessions();
  const _id = hashSessionToken(token);
  const session = await col.findOne({ _id });
  if (!session) return null;

  const valid =
    now < session.idleExpiresAt &&
    (session.absoluteExpiresAt === null || now < session.absoluteExpiresAt);
  if (!valid) {
    // The TTL monitor is lazy, so expiry is enforced here. Delete only if still unchanged.
    await col.deleteOne({ _id, idleExpiresAt: session.idleExpiresAt });
    return null;
  }

  if (now.getTime() - session.lastSeenAt.getTime() < SESSION_TOUCH_INTERVAL_MS) {
    return { session, refreshed: false };
  }

  const idleExpiresAt = plus(now, SESSION_POLICY[session.kind].idleMs);
  const next: SessionDoc = {
    ...session,
    lastSeenAt: now,
    idleExpiresAt,
    expiresAt: earliest(idleExpiresAt, session.absoluteExpiresAt),
  };
  const res = await col.updateOne(
    { _id, lastSeenAt: session.lastSeenAt },
    { $set: { lastSeenAt: next.lastSeenAt, idleExpiresAt, expiresAt: next.expiresAt } },
  );
  if (res.modifiedCount === 1) return { session: next, refreshed: true };
  // Nothing matched: the session was revoked, or another request touched it first.
  // Re-read so a revoked session is never reported valid.
  const current = await col.findOne({ _id });
  if (!current) return null;
  const stillValid =
    now < current.idleExpiresAt &&
    (current.absoluteExpiresAt === null || now < current.absoluteExpiresAt);
  return stillValid ? { session: current, refreshed: false } : null;
}

export async function revokeSession(token: string): Promise<void> {
  await (await sessions()).deleteOne({ _id: hashSessionToken(token) });
}

export async function revokeUserSessions(userId: ObjectId): Promise<number> {
  return (await (await sessions()).deleteMany({ userId })).deletedCount;
}
