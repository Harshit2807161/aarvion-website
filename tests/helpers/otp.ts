import { readOutbox } from "../../src/server/deps";

/** The latest code delivered to `to` via the mock outbox (SMS vars.code, or first 6 digits of email text). */
export async function lastOtpCode(to: string): Promise<string> {
  const msgs = await readOutbox(to);
  const last = msgs.at(-1);
  if (!last) throw new Error(`no outbox message for ${to}`);
  const p = last.payload as { vars?: { code?: string }; text?: string };
  if (last.channel === "sms") {
    if (!p.vars?.code) throw new Error("sms outbox message has no code");
    return p.vars.code;
  }
  const m = /\b\d{6}\b/.exec(p.text ?? "");
  if (!m) throw new Error("email outbox message has no code");
  return m[0];
}
