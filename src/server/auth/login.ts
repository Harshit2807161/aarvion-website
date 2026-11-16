import { z } from "zod";
import { getDeps } from "../deps.ts";
import { hitRateLimit } from "../security/rate-limit.ts";
import { normalizeIdentifier, identifierKey, type Channel } from "./identifier.ts";
import { OTP_TTL_MS, cancelOtpChallenge, issueOtpChallenge, resendCooldownSec } from "./otp.ts";

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
