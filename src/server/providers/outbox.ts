import { randomUUID } from "node:crypto";
import { getDb } from "../db/client.ts";
import { registerIndexes } from "../db/indexes.ts";
import { getEnv } from "../env.ts";

export const OUTBOX_COLLECTION = "dev_outbox";
const TTL_MS = 24 * 60 * 60 * 1000;

registerIndexes(OUTBOX_COLLECTION, [
  { key: { expiresAt: 1 }, name: "expiresAt_1", expireAfterSeconds: 0 },
  { key: { to: 1, createdAt: 1 }, name: "to_1_createdAt_1" },
]);

export type OutboxMessage = {
  _id: string;
  channel: "sms" | "email";
  to: string;
  createdAt: Date;
  expiresAt: Date;
  payload: Record<string, unknown>;
};

export async function writeOutbox(
  channel: OutboxMessage["channel"],
  to: string,
  payload: Record<string, unknown>,
): Promise<{ providerMessageId: string }> {
  const id = `mock_${randomUUID()}`;
  const now = new Date();
  const db = await getDb();
  await db.collection<OutboxMessage>(OUTBOX_COLLECTION).insertOne({
    _id: id,
    channel,
    to,
    createdAt: now,
    expiresAt: new Date(now.getTime() + TTL_MS),
    payload,
  });
  return { providerMessageId: id };
}

/** Dev and test only: reads messages the mock providers captured. */
export async function readOutbox(to: string): Promise<OutboxMessage[]> {
  if (getEnv().VERCEL_ENV === "production") {
    throw new Error("readOutbox is not available in production");
  }
  const db = await getDb();
  return db
    .collection<OutboxMessage>(OUTBOX_COLLECTION)
    .find({ to })
    .sort({ createdAt: 1 })
    .toArray();
}
