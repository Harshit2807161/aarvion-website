import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// reviewRx runs only on the IST helpers, but R4 will call it on a server in any zone, so pin
// the boundary cases under a few TZ values in a child process (like validity.carries.test.ts).
describe("reviewRx server time zone independence", () => {
  const modulePath = fileURLToPath(new URL("./review.ts", import.meta.url));
  const script = `
    const m = await import(${JSON.stringify("file://" + modulePath)});
    const at = (iso) => ({ at: new Date(iso), by: "s" });
    const input = (rxDate, validUntil) => ({ type: "approve", input: { doctorName: "Dr A", doctorRegNo: "DMC/1", rxDate, validUntil } });
    const ok = m.reviewRx({ status: "pending" }, input("2026-11-12"), at("2026-11-20T06:00:00Z"));
    const out = {
      end: ok.set.validUntil.toISOString(),
      todayIst: m.reviewRx({ status: "pending" }, input("2026-11-21"), at("2026-11-20T18:30:00Z")).ok,
      futureIst: m.reviewRx({ status: "pending" }, input("2026-11-21"), at("2026-11-20T18:29:59.999Z")).error,
      outdated: m.reviewRx({ status: "pending" }, input("2026-05-20"), at("2026-11-19T18:30:00Z")).error,
    };
    console.log(JSON.stringify(out));
  `;
  it.each(["UTC", "America/Los_Angeles", "Pacific/Auckland", "Asia/Kolkata"])(
    "gives identical results under TZ=%s",
    (tz) => {
      const stdout = execFileSync(
        process.execPath,
        ["--experimental-strip-types", "--no-warnings", "--input-type=module", "-e", script],
        { env: { ...process.env, TZ: tz }, encoding: "utf8" },
      );
      expect(JSON.parse(stdout)).toEqual({
        end: "2027-05-11T18:30:00.000Z",
        todayIst: true,
        futureIst: "rx_date_in_future",
        outdated: "rx_outdated",
      });
    },
  );
});
