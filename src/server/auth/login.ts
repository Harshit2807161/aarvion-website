import { z } from "zod";
import { POLICY_VERSION } from "../../config/site.ts";
import { appendAudit } from "../audit.ts";
import { getDeps } from "../deps.ts";
import { hitRateLimit, peekRateLimit, resetRateLimit } from "../security/rate-limit.ts";
import { normalizeIdentifier, identifierKey, type Channel } from "./identifier.ts";
import {
  OTP_TTL_MS,
  cancelOtpChallenge,
  issueOtpChallenge,
  resendCooldownSec,
  verifyOtpChallenge,
} from "./otp.ts";
import { createSession, revokeSession, sessionKindForRole, type SessionKind } from "./sessions.ts";
import { findOrCreateUserByIdentifier, toPublicUser, type PublicUser } from "./users.ts";

export const SendOtpBody = z.object({
  channel: z.enum(["phone", "email"]),
  identifier: z.string().min(1).max(254),
});

export const OTP_SEND_LIMITS = {
  perIp: { limit: 20, windowMs: 3_600_000 },
  perIdentifier: { limit: 3, windowMs: 600_000 },
} as const;

export const RESEND_AFTER_SEC = 30;

export type SendOtpResult =
  | { ok: true; resendAfterSec: 30 }
  | { ok: false; error: "invalid_identifier" }
  | { ok: false; error: "resend_cooldown" | "rate_limited"; retryAfterSec: number }
  | { ok: false; error: "delivery_failed" };

const MINUTES = String(OTP_TTL_MS / 60_000);

/**
 * Order is fixed: normalise, resend cooldown (spends no budget), per-IP limit,
 * per-identifier limit, issue, deliver. The result never depends on whether an
 * account exists, and the code is never logged or returned.
 */
export async function sendOtp(i: {
  channel: Channel;
  identifier: string;
  ipBucket: string;
  now: Date;
}): Promise<SendOtpResult> {
  const id = normalizeIdentifier(i.channel, i.identifier);
  if (!id) return { ok: false, error: "invalid_identifier" };

  const wait = await resendCooldownSec(id, i.now);
  if (wait > 0) return { ok: false, error: "resend_cooldown", retryAfterSec: wait };

  const ip = await hitRateLimit({
    key: `otp-send:ip:${i.ipBucket}`,
    ...OTP_SEND_LIMITS.perIp,
    now: i.now,
  });
  if (!ip.allowed) return { ok: false, error: "rate_limited", retryAfterSec: ip.retryAfterSec };

  const per = await hitRateLimit({
    key: `otp-send:id:${identifierKey(id)}`,
    ...OTP_SEND_LIMITS.perIdentifier,
    now: i.now,
  });
  if (!per.allowed) return { ok: false, error: "rate_limited", retryAfterSec: per.retryAfterSec };

  const issued = await issueOtpChallenge(id, i.now);
  if (!issued.ok) {
    return { ok: false, error: "resend_cooldown", retryAfterSec: issued.retryAfterSec };
  }

  const { code } = issued;
  const { sms, email } = getDeps();
  try {
    if (id.channel === "phone") {
      await sms.send({ to: id.value, templateId: "otp", vars: { code, minutes: MINUTES } });
    } else {
      const text = `${code} is your Aarvion login code. It expires in ${MINUTES} minutes. Aarvion staff will never ask you for this code.`;
      await email.send({
        to: id.value,
        subject: "Your Aarvion login code",
        text,
        html: `<p><strong>${code}</strong> is your Aarvion login code. It expires in ${MINUTES} minutes. Aarvion staff will never ask you for this code.</p>`,
      });
    }
  } catch (err) {
    console.error("otp delivery failed", err instanceof Error ? err.name : "unknown");
    await cancelOtpChallenge(id, issued.challengeId);
    return { ok: false, error: "delivery_failed" };
  }
  return { ok: true, resendAfterSec: RESEND_AFTER_SEC };
}

/** The policy version a sign-up accepts; stored with the consent. */
export const CONSENT_VERSION = POLICY_VERSION;

/**
 * What a new account sends with its first verify: a name with at least one letter, the
 * Terms and Privacy acceptance and the 18+ declaration (both must be true), and the marketing
 * choice (optional in the UI, off by default, but always stated here). Unknown keys are refused.
 *
 * After trimming, the name may hold no Unicode control or format character (`\p{C}`): zero-width
 * and bidi marks survive `trim()` and can hide or reorder a name in staff views and emails.
 */
export const SignupInput = z.strictObject({
  name: z
    .string()
    .trim()
    .min(2)
    .max(80)
    .regex(/\p{L}/u)
    .regex(/^\P{C}*$/u),
  adult: z.literal(true),
  termsPrivacy: z.literal(true),
  marketing: z.boolean(),
});
export type SignupInput = z.infer<typeof SignupInput>;

/**
 * F6: `code` is a loose string so every bad code, including a malformed one,
 * takes the same invalid_code path as a wrong one. A bad `signup` is 400 invalid_request.
 */
export const VerifyOtpBody = SendOtpBody.extend({
  code: z.string().max(16),
  signup: SignupInput.optional(),
});

/**
 * Known risk (F11): the cap is keyed by identifier alone, so a third party who
 * knows a phone or email can lock that user out of login for 24 h. Only a code
 * mismatch against a live challenge counts, so each lockout costs the attacker
 * real OTP sends, which the send limits throttle.
 */
export const OTP_VERIFY_FAILURE_LIMIT = { limit: 10, windowMs: 86_400_000 } as const;

/** Every verify request with a well-formed identifier counts, whatever its outcome. */
export const OTP_VERIFY_IP_LIMIT = { limit: 60, windowMs: 3_600_000 } as const;

export type VerifyOtpResult =
  | { ok: true; user: PublicUser; isNewUser: boolean; token: string; kind: SessionKind }
  | { ok: false; error: "invalid_code" }
  | { ok: false; error: "too_many_attempts" | "rate_limited"; retryAfterSec: number };

/**
 * Order is fixed: normalise, per-IP limit, failure cap (peek), verify the
 * challenge, find or create the user, revoke any presented session
 * (anti-fixation), create a fresh session, clear the failure counter. Every
 * failure reason collapses to invalid_code, but only a mismatch counts toward
 * the cap: a verify with no live challenge cannot guess anything. The code and
 * the token are never logged or returned. A new user is created with the name
 * and consents from `signup`; an existing user's are never changed.
 */
export async function verifyOtpAndLogin(i: {
  channel: Channel;
  identifier: string;
  code: string;
  signup?: SignupInput | undefined;
  ipBucket: string;
  existingToken: string | null;
  now: Date;
}): Promise<VerifyOtpResult> {
  const id = normalizeIdentifier(i.channel, i.identifier);
  if (!id) return { ok: false, error: "invalid_code" };

  const ip = await hitRateLimit({
    key: `otp-verify:ip:${i.ipBucket}`,
    ...OTP_VERIFY_IP_LIMIT,
    now: i.now,
  });
  if (!ip.allowed) return { ok: false, error: "rate_limited", retryAfterSec: ip.retryAfterSec };

  const failureKey = `otp-verify-fail:${identifierKey(id)}`;
  const cap = await peekRateLimit({ key: failureKey, ...OTP_VERIFY_FAILURE_LIMIT, now: i.now });
  if (!cap.allowed)
    return { ok: false, error: "too_many_attempts", retryAfterSec: cap.retryAfterSec };

  const verified = await verifyOtpChallenge(id, i.code, i.now);
  if (!verified.ok) {
    if (verified.reason === "mismatch") {
      await hitRateLimit({ key: failureKey, ...OTP_VERIFY_FAILURE_LIMIT, now: i.now });
    }
    return { ok: false, error: "invalid_code" };
  }

  // Written on insert only: an existing user's name and consents are never replaced.
  const signup = i.signup && {
    name: i.signup.name,
    consents: {
      channel: id.channel,
      termsPrivacy: { version: CONSENT_VERSION, at: i.now },
      adult: { at: i.now },
      marketing: { optedIn: i.signup.marketing, at: i.now },
    },
  };
  const { user, created } = await findOrCreateUserByIdentifier(id, i.now, signup);
  if (i.existingToken) await revokeSession(i.existingToken);
  const { token } = await createSession(user, i.now);
  // C6: the user is logged in by now, so a failing counter reset is logged, never a 500.
  try {
    await resetRateLimit(failureKey);
  } catch (err) {
    console.error("rate limit reset failed", err instanceof Error ? err.name : "unknown");
  }
  // F7: the audit trail must not be able to break a login that already succeeded.
  try {
    await appendAudit({
      at: i.now,
      action: "auth.login",
      actor: { type: "user", userId: user._id, role: user.role },
      meta: { channel: id.channel, isNewUser: created },
    });
  } catch (err) {
    console.error("audit write failed", err instanceof Error ? err.name : "unknown");
  }
  return {
    ok: true,
    user: toPublicUser(user),
    isNewUser: created,
    token,
    kind: sessionKindForRole(user.role),
  };
}
