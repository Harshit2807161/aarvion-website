import { describe, expect, it } from "vitest";
import { clientIp, ipBucket } from "./client-ip";

const req = (headers: Record<string, string>) => new Request("http://x.test/", { headers });

describe("clientIp", () => {
  it("reads x-real-ip, trimmed", () => {
    expect(clientIp(req({ "x-real-ip": " 203.0.113.7 " }))).toBe("203.0.113.7");
  });
  it("ignores the spoofable x-forwarded-for", () => {
    expect(clientIp(req({ "x-forwarded-for": "198.51.100.1, 10.0.0.1" }))).toBe("unknown");
  });
  it("prefers x-real-ip over x-forwarded-for", () => {
    expect(clientIp(req({ "x-real-ip": "203.0.113.7", "x-forwarded-for": "198.51.100.1" }))).toBe(
      "203.0.113.7",
    );
  });
  it("returns unknown with no headers or a blank x-real-ip", () => {
    expect(clientIp(req({}))).toBe("unknown");
    expect(clientIp(req({ "x-real-ip": "  " }))).toBe("unknown");
  });
});

describe("ipBucket", () => {
  it("returns IPv4 unchanged", () => {
    expect(ipBucket("203.0.113.7")).toBe("203.0.113.7");
  });
  it("buckets IPv6 by /64, expanded and lowercased", () => {
    expect(ipBucket("2001:db8:abcd:12:1:2:3:4")).toBe("2001:db8:abcd:12::/64");
    expect(ipBucket("2001:DB8:abcd:12::99")).toBe("2001:db8:abcd:12::/64");
    expect(ipBucket("2001:db8:abcd:13::1")).not.toBe("2001:db8:abcd:12::/64");
  });
  it("expands short forms", () => {
    expect(ipBucket("::1")).toBe("0:0:0:0::/64");
  });
  it("maps IPv4-mapped IPv6 to IPv4", () => {
    expect(ipBucket("::ffff:203.0.113.7")).toBe("203.0.113.7");
  });
  it.each([
    ["::ffff:cb00:7107", "203.0.113.7"],
    ["::FFFF:CB00:7107", "203.0.113.7"],
    ["0:0:0:0:0:ffff:cb00:7107", "203.0.113.7"],
    ["0000:0000:0000:0000:0000:ffff:cb00:7107", "203.0.113.7"],
    ["0:0:0:0:0:ffff:203.0.113.7", "203.0.113.7"],
    ["::ffff:203.0.113.7", "203.0.113.7"],
    ["::ffff:0:1", "0.0.0.1"],
  ])("unmaps IPv4-mapped form %s to IPv4", (ip, want) => {
    expect(ipBucket(ip)).toBe(want);
  });
  it("does not share one bucket across different mapped IPv4 addresses", () => {
    expect(ipBucket("::ffff:cb00:7107")).not.toBe(ipBucket("::ffff:cb00:7108"));
  });
  it("does not unmap non-mapped IPv6 that merely resembles it", () => {
    expect(ipBucket("::fffe:cb00:7107")).toBe("0:0:0:0::/64");
    expect(ipBucket("1::ffff:cb00:7107")).toBe("1:0:0:0::/64");
  });
  it("returns unknown for junk", () => {
    expect(ipBucket("not-an-ip")).toBe("unknown");
    expect(ipBucket("unknown")).toBe("unknown");
  });
});
