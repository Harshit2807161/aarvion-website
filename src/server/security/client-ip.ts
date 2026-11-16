import { isIPv4, isIPv6 } from "node:net";

/**
 * The client IP as set by the trusted proxy in `x-real-ip`. `x-forwarded-for` is
 * deliberately ignored: clients can spoof it. Without the header every client
 * shares the "unknown" bucket.
 */
export function clientIp(req: Request): string {
  const v = req.headers.get("x-real-ip")?.trim();
  return v ? v : "unknown";
}

/** Rate-limit bucket: IPv4 as is, IPv4-mapped IPv6 as IPv4, other IPv6 by /64. */
export function ipBucket(ip: string): string {
  if (isIPv4(ip)) return ip;
  if (!isIPv6(ip)) return "unknown";
  const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i.exec(ip);
  if (mapped && isIPv4(mapped[1]!)) return mapped[1]!;
  return `${expandIPv6(ip).slice(0, 4).join(":")}::/64`;
}

/** Expands a valid IPv6 address to 8 lowercase hextets without leading zeros. */
function expandIPv6(ip: string): string[] {
  let addr = ip.toLowerCase();
  const zone = addr.indexOf("%");
  if (zone >= 0) addr = addr.slice(0, zone);
  const v4 = /(\d{1,3}(?:\.\d{1,3}){3})$/.exec(addr);
  if (v4) {
    const [a, b, c, d] = v4[1]!.split(".").map(Number) as [number, number, number, number];
    addr =
      addr.slice(0, -v4[1]!.length) +
      ((a << 8) | b).toString(16) +
      ":" +
      ((c << 8) | d).toString(16);
  }
  const [head = "", tail] = addr.split("::");
  const h = head ? head.split(":") : [];
  const t = tail ? tail.split(":") : [];
  const fill = tail === undefined ? [] : Array<string>(8 - h.length - t.length).fill("0");
  return [...h, ...fill, ...t].map((x) => parseInt(x, 16).toString(16));
}
