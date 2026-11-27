import { afterEach, describe, expect, it } from "vitest";
import { reviewRx, rxView } from "./review";

// reviewRx runs only on the IST helpers, but R4 will call it on a server in any zone, so pin the
// boundary cases under a few TZ values. review.ts imports auth/login (the PersonName rule), which
// a bare Node child process cannot load, so (unlike validity.carries.test.ts) this switches
// process.env.TZ in-process; Node re-reads it on assignment.
const original = process.env.TZ;
afterEach(() => {
  if (original === undefined) delete process.env.TZ;
  else process.env.TZ = original;
});

const at = (iso: string) => ({ at: new Date(iso), by: "s" });
const approve = (rxDate: string) => ({
  type: "approve" as const,
  input: { doctorName: "Dr A", doctorRegNo: "DMC/1", rxDate },
});

const OFFSET_MIN: Record<string, number> = {
  UTC: 0,
  "America/Los_Angeles": 480,
  "Pacific/Auckland": -720,
  "Asia/Kolkata": -330,
};

describe("reviewRx server time zone independence", () => {
  it.each(["UTC", "America/Los_Angeles", "Pacific/Auckland", "Asia/Kolkata"])(
    "gives identical results under TZ=%s",
    (tz) => {
      process.env.TZ = tz;
      // Sanity: the assignment took effect, so the zones below really differ from each other.
      expect(new Date(0).getTimezoneOffset()).toBe(OFFSET_MIN[tz]);
      const ok = reviewRx({ status: "pending" }, approve("2026-11-12"), at("2026-11-20T06:00:00Z"));
      expect(ok.ok && ok.set.status === "approved" && ok.set.validUntil.toISOString()).toBe(
        "2027-05-11T18:30:00.000Z",
      );
      const run = (rx: string, now: string) =>
        reviewRx({ status: "pending" }, approve(rx), at(now));
      expect(run("2026-11-21", "2026-11-20T18:30:00Z").ok).toBe(true);
      expect(run("2026-11-21", "2026-11-20T18:29:59.999Z")).toEqual({
        ok: false,
        error: "rx_date_in_future",
      });
      expect(run("2026-05-20", "2026-11-19T18:30:00Z")).toEqual({
        ok: false,
        error: "rx_outdated",
      });
      const doc = {
        _id: { toHexString: () => "x" },
        patientName: "P",
        file: { kind: "pdf" as const, pages: 1 },
        status: "approved" as const,
        review: null,
        rxDate: new Date("2026-11-11T18:30:00Z"),
        validUntil: new Date("2027-05-11T18:30:00Z"),
        createdAt: new Date("2026-11-12T10:00:00Z"),
      };
      const view = (now: string) => rxView(doc, new Date(now));
      expect(view("2027-05-11T18:29:59.999Z")).toMatchObject({
        status: "approved",
        validUntilDay: "2027-05-11",
      });
      expect(view("2027-05-11T18:30:00Z")).toMatchObject({
        status: "expired",
        expiredOnDay: "2027-05-12",
      });
    },
  );
});
