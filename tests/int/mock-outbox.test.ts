import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getDb } from "@/server/db/client";
import { ensureIndexes } from "@/server/db/indexes";
import "@/server/db/register-all";
import { getDeps, readOutbox, resetDepsForTests } from "@/server/deps";
import { startMemoryReplSet, stopMemoryReplSet } from "../helpers/mongo";

beforeAll(async () => {
  resetDepsForTests();
  await startMemoryReplSet();
}, 120_000);
afterAll(stopMemoryReplSet);

describe("mock outbox", () => {
  it("captures SMS vars and email content", async () => {
    const { sms, email } = getDeps();
    await sms.send({ to: "+919876543210", templateId: "otp", vars: { code: "123456" } });
    await email.send({ to: "a@b.test", subject: "Hi", html: "<p>x</p>", text: "x" });
    const msgs = await readOutbox("+919876543210");
    expect(msgs).toHaveLength(1);
    expect(msgs[0]?.payload).toEqual({ templateId: "otp", vars: { code: "123456" } });
    expect((await readOutbox("a@b.test"))[0]?.payload).toMatchObject({ subject: "Hi" });
  });

  it("ensureIndexes after register-all creates the dev_outbox expiresAt TTL index", async () => {
    const db = await getDb();
    await ensureIndexes(db);
    const idx = (await db.collection("dev_outbox").indexes()).find((i) => i.name === "expiresAt_1");
    expect(idx).toMatchObject({ key: { expiresAt: 1 }, expireAfterSeconds: 0 });
  });
});
