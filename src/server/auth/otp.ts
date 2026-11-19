import { createHmac, randomInt, randomUUID, timingSafeEqual } from "node:crypto";
import { getDb } from "../db/client.ts";
import { registerIndexes } from "../db/indexes.ts";
import { requireEnv } from "../env.ts";
import { identifierKey, type Identifier } from "./identifier.ts";

export const OTP_COLLECTION = "otp_challenges";
export const OTP_TTL_MS = 300_000;
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_RESEND_COOLDOWN_MS = 30_000;

registerIndexes(OTP_COLLECTION, [
  { key: { expiresAt: 1 }, name: "expiresAt_ttl", expireAfterSeconds: 0 },
]);

type OtpDoc = {
  _id: string;
  challengeId: string;
  codeHash: string;
  attempts: number;
  createdAt: Date;
  expiresAt: Date;
  resendAvailableAt: Date;
  consumedAt: Date | null;
};

export type IssueResult =
  | { ok: true; code: string; challengeId: string; expiresAt: Date }
  | { ok: false; reason: "cooldown"; retryAfterSec: number };

export type VerifyResult =
  | { ok: true }
  | { ok: false; reason: "no_active_challenge" | "mismatch" | "consumed_concurrently" };

const plus = (d: Date, ms: number) => new Date(d.getTime() + ms);

async function collection() {
  return (await getDb()).collection<OtpDoc>(OTP_COLLECTION);
}

export function generateOtpCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

export function hashOtp(i: { challengeId: string; identifier: Identifier; code: string }): string {
  const { channel, value } = i.identifier;
  return createHmac("sha256", requireEnv("OTP_PEPPER"))
    .update(`${i.challengeId}:${channel}:${value}:${i.code}`)
    .digest("hex");
}

/** Seconds until a resend is allowed; 0 when allowed (or no challenge exists). */
export async function resendCooldownSec(id: Identifier, now: Date): Promise<number> {
  const doc = await (await collection()).findOne({ _id: identifierKey(id) });
  if (!doc) return 0;
  return Math.max(0, Math.ceil((doc.resendAvailableAt.getTime() - now.getTime()) / 1000));
}

export async function issueOtpChallenge(id: Identifier, now: Date): Promise<IssueResult> {
  const col = await collection();
  const code = generateOtpCode();
  const challengeId = randomUUID();
  const expiresAt = plus(now, OTP_TTL_MS);
  try {
    // Matches only when the cooldown is over; a live challenge makes the upsert's insert
    // collide on _id, so concurrent issues produce exactly one winner.
    await col.updateOne(
      { _id: identifierKey(id), resendAvailableAt: { $lte: now } },
      {
        $set: {
          challengeId,
          codeHash: hashOtp({ challengeId, identifier: id, code }),
          attempts: 0,
          createdAt: now,
          consumedAt: null,
          expiresAt,
          resendAvailableAt: plus(now, OTP_RESEND_COOLDOWN_MS),
        },
      },
      { upsert: true },
    );
  } catch (err) {
    if ((err as { code?: number }).code !== 11000) throw err;
    return {
      ok: false,
      reason: "cooldown",
      retryAfterSec: Math.max(1, await resendCooldownSec(id, now)),
    };
  }
  return { ok: true, code, challengeId, expiresAt };
}

/** Removes a challenge whose delivery failed, so the user is not stuck in cooldown. */
export async function cancelOtpChallenge(id: Identifier, challengeId: string): Promise<void> {
  await (await collection()).deleteOne({ _id: identifierKey(id), challengeId });
}

type SpendResult =
  { ok: true; doc: OtpDoc } | { ok: false; reason: "no_active_challenge" | "mismatch" };

/**
 * The one code check every caller shares: spend an attempt atomically, then compare the hashes
 * in constant time. It never consumes the challenge; the caller decides what a match means.
 */
async function spendAndCompare(id: Identifier, code: string, now: Date): Promise<SpendResult> {
  const col = await collection();
  // Spend an attempt atomically; null means missing, expired, used or locked.
  const doc = await col.findOneAndUpdate(
    {
      _id: identifierKey(id),
      consumedAt: null,
      expiresAt: { $gt: now },
      attempts: { $lt: OTP_MAX_ATTEMPTS },
    },
    { $inc: { attempts: 1 } },
    { returnDocument: "after" },
  );
  if (!doc) return { ok: false, reason: "no_active_challenge" };

  const expected = Buffer.from(doc.codeHash, "hex");
  const actual = Buffer.from(
    hashOtp({ challengeId: doc.challengeId, identifier: id, code }),
    "hex",
  );
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    return { ok: false, reason: "mismatch" };
  }
  return { ok: true, doc };
}

export async function verifyOtpChallenge(
  id: Identifier,
  code: string,
  now: Date,
): Promise<VerifyResult> {
  const spent = await spendAndCompare(id, code, now);
  if (!spent.ok) return spent;
  const { doc } = spent;
  const col = await collection();

  // Single use: only one racer flips consumedAt.
  const used = await col.updateOne(
    { _id: doc._id, challengeId: doc.challengeId, consumedAt: null },
    { $set: { consumedAt: now } },
  );
  return used.modifiedCount === 1 ? { ok: true } : { ok: false, reason: "consumed_concurrently" };
}

/**
 * Checks a code without using it up, for a sign-up that still needs the user's details. A
 * mismatch keeps its spent attempt, exactly as verify does; a match refunds it and leaves the
 * challenge unconsumed, so the same code can log in once later. The refund matches only the
 * same live challenge and never takes attempts below 0.
 */
export async function checkOtpChallenge(
  id: Identifier,
  code: string,
  now: Date,
): Promise<VerifyResult> {
  const spent = await spendAndCompare(id, code, now);
  if (!spent.ok) return spent;
  const { doc } = spent;
  const col = await collection();
  await col.updateOne(
    { _id: doc._id, challengeId: doc.challengeId, consumedAt: null, attempts: { $gt: 0 } },
    { $inc: { attempts: -1 } },
  );
  return { ok: true };
}
