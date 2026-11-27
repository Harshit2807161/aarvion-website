import { randomBytes } from "node:crypto";
import type { ClientSession, ObjectId } from "mongodb";
import { z } from "zod";
import { PersonName } from "../auth/login.ts";
import { getDb } from "../db/client.ts";
import { registerIndexes } from "../db/indexes.ts";
import type { RxReview, RxReviewSet, RxStatus } from "./review.ts";

/**
 * Prescription records and upload staging slots (Mongo). Ownership is always part of a read's
 * filter, so another user's id is the same miss as no record. Nothing here logs, and no function
 * takes a clock: callers pass `now`.
 */
export const PRESCRIPTIONS_COLLECTION = "prescriptions";
export const RX_STAGING_COLLECTION = "rx_staging";

registerIndexes(PRESCRIPTIONS_COLLECTION, [
  { key: { userId: 1, createdAt: -1 }, name: "userId_createdAt_desc" },
  // The pharmacist's queue, oldest first (phase D).
  { key: { status: 1, createdAt: 1 }, name: "status_createdAt" },
]);
registerIndexes(RX_STAGING_COLLECTION, [
  { key: { expiresAt: 1 }, name: "expiresAt_ttl", expireAfterSeconds: 0 },
]);

export type RxDoc = {
  _id: ObjectId;
  userId: ObjectId;
  patientName: string;
  declaration: { version: string; at: Date };
  file: {
    key: string;
    contentType: "image/webp" | "application/pdf";
    kind: "image" | "pdf";
    pages: number;
    bytes: number;
    sha256: string;
  };
  status: RxStatus;
  review: RxReview | null;
  rxDate: Date | null;
  validUntil: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type StagingDoc = {
  /** base64url of 16 random bytes: 22 characters. */
  _id: string;
  userId: ObjectId;
  /** rx-staging/<userIdHex>/<_id> */
  key: string;
  createdAt: Date;
  expiresAt: Date;
  /** While a finish is working on the slot: when its lease ends (a crashed claim just expires). */
  claimedUntil?: Date;
};

export const RX_STAGING_TTL_MS = 15 * 60_000;

export const RX_UPLOAD_LIMITS = {
  user: { limit: 10, windowMs: 3_600_000 },
  ip: { limit: 30, windowMs: 3_600_000 },
} as const;

export const RxCreateBody = z.strictObject({
  stagingId: z.string().regex(/^[A-Za-z0-9_-]{22}$/),
  patientName: PersonName,
  declaration: z.literal(true),
});
export type RxCreateBody = z.infer<typeof RxCreateBody>;

async function prescriptions() {
  return (await getDb()).collection<RxDoc>(PRESCRIPTIONS_COLLECTION);
}
async function staging() {
  return (await getDb()).collection<StagingDoc>(RX_STAGING_COLLECTION);
}

/** A fresh single-use slot for `userId`, valid for 15 minutes from `now`. */
export async function createStaging(userId: ObjectId, now: Date): Promise<StagingDoc> {
  const id = randomBytes(16).toString("base64url");
  const doc: StagingDoc = {
    _id: id,
    userId,
    key: `rx-staging/${userId.toHexString()}/${id}`,
    createdAt: now,
    expiresAt: new Date(now.getTime() + RX_STAGING_TTL_MS),
  };
  await (await staging()).insertOne(doc);
  return doc;
}

/** The live slot, or null (missing, another user's, or expired: `expiresAt` must be after now). */
export async function peekStaging(
  id: string,
  userId: ObjectId,
  now: Date,
): Promise<StagingDoc | null> {
  return (await staging()).findOne({ _id: id, userId, expiresAt: { $gt: now } });
}

/** How long one finish may hold a slot before another can claim it. */
export const RX_CLAIM_LEASE_MS = 30_000;

/**
 * Lease the live slot to one finish, atomically, so the expensive work (re-encode, final put)
 * runs once at a time per slot. Null when the slot is missing, expired, another user's, or
 * leased by a running finish (the caller peeks to tell which).
 */
export async function claimStaging(
  id: string,
  userId: ObjectId,
  now: Date,
): Promise<StagingDoc | null> {
  return (await staging()).findOneAndUpdate(
    {
      _id: id,
      userId,
      expiresAt: { $gt: now },
      $or: [{ claimedUntil: { $exists: false } }, { claimedUntil: { $lte: now } }],
    },
    { $set: { claimedUntil: new Date(now.getTime() + RX_CLAIM_LEASE_MS) } },
    { returnDocument: "after" },
  );
}

/** Ends a lease early (an abort or a retryable refusal), so a retry can claim the slot at once. */
export async function releaseStaging(id: string, userId: ObjectId): Promise<void> {
  await (await staging()).updateOne({ _id: id, userId }, { $unset: { claimedUntil: "" } });
}

/** Single use: deletes and returns the live slot, atomically (inside `session`'s transaction if given). */
export async function takeStaging(
  id: string,
  userId: ObjectId,
  now: Date,
  session?: ClientSession,
): Promise<StagingDoc | null> {
  return (await staging()).findOneAndDelete(
    { _id: id, userId, expiresAt: { $gt: now } },
    { session },
  );
}

export async function insertRx(doc: RxDoc, session?: ClientSession): Promise<void> {
  await (await prescriptions()).insertOne(doc, { session });
}

/** The user's prescriptions, newest first. */
export async function listRxForUser(userId: ObjectId, limit = 50): Promise<RxDoc[]> {
  return (await prescriptions()).find({ userId }).sort({ createdAt: -1 }).limit(limit).toArray();
}

/** One prescription, only if it belongs to `userId`. */
export async function getRxForUser(id: ObjectId, userId: ObjectId): Promise<RxDoc | null> {
  return (await prescriptions()).findOne({ _id: id, userId });
}

/**
 * Writes a review (from `reviewRx`) only if the record is still in the status it was read in,
 * so two pharmacists cannot both decide it. True when this call applied it.
 */
export async function applyRxReview(
  id: ObjectId,
  from: RxStatus,
  set: RxReviewSet,
  now: Date,
): Promise<boolean> {
  const res = await (
    await prescriptions()
  ).updateOne({ _id: id, status: from }, { $set: { ...set, updatedAt: now } });
  return res.modifiedCount === 1;
}
