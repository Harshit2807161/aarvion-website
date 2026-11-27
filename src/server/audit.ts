import type { ClientSession, ObjectId } from "mongodb";
import { getDb } from "./db/client.ts";
import { registerIndexes } from "./db/indexes.ts";
import type { Role } from "./auth/roles.ts";

registerIndexes("audit_logs", [
  { key: { at: -1 }, name: "at_desc" },
  { key: { "actor.userId": 1, at: -1 }, name: "actorUserId_at_desc" },
]);

export type AuditAction = "auth.login" | "auth.logout" | "rx.upload" | "rx.view";

/** Ids, hashes and flags only: never a phone, email, code or token. */
export type AuditEntry = {
  at: Date;
  action: AuditAction;
  actor: { type: "user"; userId: ObjectId; role: Role } | { type: "system" };
  target?: { type: string; id: string };
  meta?: Record<string, string | number | boolean | null>;
};

/**
 * Append-only by construction: this is the only function that touches the collection. Pass a
 * `session` to write the row in the same transaction as the change it records.
 */
export async function appendAudit(entry: AuditEntry, session?: ClientSession): Promise<void> {
  await (await getDb()).collection<AuditEntry>("audit_logs").insertOne(entry, { session });
}
