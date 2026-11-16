import { MongoServerError } from "mongodb";
import { getDb } from "@/server/db/client";

export const COUNTERS_COLLECTION = "counters";

type CounterDoc = { _id: string; seq: number };

const monthParts = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Kolkata",
  year: "2-digit",
  month: "2-digit",
});

/** `YYMM` of the Asia/Kolkata calendar month; independent of the process TZ. */
export function orderMonthKey(now: Date): string {
  const parts = monthParts.formatToParts(now);
  const year = parts.find((p) => p.type === "year")?.value;
  const month = parts.find((p) => p.type === "month")?.value;
  if (!year || !month) throw new Error("could not derive the IST month");
  return `${year}${month}`;
}

/** `AAR-YYMM-NNNNN`. The sequence is zero-padded to 5 digits and never truncated. */
export function formatOrderNumber(yymm: string, seq: number): string {
  if (!/^\d{4}$/.test(yymm)) throw new RangeError(`yymm must be 4 digits, got ${yymm}`);
  if (!Number.isInteger(seq) || seq < 1) {
    throw new RangeError(`seq must be an integer >= 1, got ${seq}`);
  }
  return `AAR-${yymm}-${String(seq).padStart(5, "0")}`;
}

/**
 * Atomically takes the next number for the IST month of `now`. Two concurrent
 * first calls can both attempt the upsert insert; the loser gets E11000 and
 * retries once, by which point the document exists and `$inc` applies.
 */
export async function nextOrderNumber(now: Date): Promise<string> {
  const yymm = orderMonthKey(now);
  const col = (await getDb()).collection<CounterDoc>(COUNTERS_COLLECTION);
  const bump = () =>
    col.findOneAndUpdate(
      { _id: `order-number:${yymm}` },
      { $inc: { seq: 1 } },
      { upsert: true, returnDocument: "after" },
    );

  let doc: CounterDoc | null;
  try {
    doc = await bump();
  } catch (err) {
    if (!(err instanceof MongoServerError) || err.code !== 11000) throw err;
    doc = await bump();
  }
  if (!doc) throw new Error("order-number counter update returned no document");
  return formatOrderNumber(yymm, doc.seq);
}
