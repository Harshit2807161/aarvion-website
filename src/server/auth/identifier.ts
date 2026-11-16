import { z } from "zod";

export type Channel = "phone" | "email";
export type Identifier = { channel: Channel; value: string };

/** Returns "+91XXXXXXXXXX" for a valid Indian mobile number, otherwise null. */
export function normalizePhone(raw: string): string | null {
  let s = raw.replace(/[\s\-()]/g, "");
  if (s.startsWith("+91")) s = s.slice(3);
  else if (s.length === 12 && s.startsWith("91")) s = s.slice(2);
  else if (s.length === 11 && s.startsWith("0")) s = s.slice(1);
  return /^[6-9]\d{9}$/.test(s) ? `+91${s}` : null;
}

const emailSchema = z.email();

export function normalizeEmail(raw: string): string | null {
  const s = raw.trim().toLowerCase();
  if (s.length > 254) return null;
  return emailSchema.safeParse(s).success ? s : null;
}

export function normalizeIdentifier(channel: Channel, raw: string): Identifier | null {
  const value = channel === "phone" ? normalizePhone(raw) : normalizeEmail(raw);
  return value === null ? null : { channel, value };
}

export function identifierKey(id: Identifier): string {
  return `${id.channel}:${id.value}`;
}
