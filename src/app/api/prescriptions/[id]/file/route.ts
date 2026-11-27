import { ObjectId } from "mongodb";
import { connection } from "next/server";
import { appendAudit } from "@/server/audit";
import { requireUser, sessionRefreshHeaders } from "@/server/auth/guards";
import { getDeps } from "@/server/deps";
import { HttpError, withErrors } from "@/server/http";
import { RX_MAX_BYTES } from "@/server/prescriptions/file-check";
import { getRxForUser } from "@/server/prescriptions/prescriptions";
import { hitRateLimit } from "@/server/security/rate-limit";

const RX_FILE_LIMIT = { limit: 120, windowMs: 3_600_000 } as const;
const OBJECT_ID = /^[0-9a-f]{24}$/;

type Ctx = { params: Promise<{ id: string }> };

/**
 * `GET /api/prescriptions/[id]/file`: the owner's prescription file, nobody else's (staff reads
 * are phase D, through a sibling route). Every miss, whether a malformed id, another user's record,
 * a deleted record or a missing file, is the same 404 `not_found`, so existence never leaks, and
 * writes no audit row. A served file is audited first (`rx.view`): if that write fails the request
 * fails and no bytes are sent. The type comes from the stored record, never the request, and the
 * headers keep the file from being cached, sniffed, scripted or embedded elsewhere.
 */
export const GET = withErrors(async (req, { params }: Ctx) => {
  await connection();
  const auth = await requireUser(req);
  const now = getDeps().now();
  const userHex = auth.user._id.toHexString();
  const limit = await hitRateLimit({ key: `rx-file:user:${userHex}`, ...RX_FILE_LIMIT, now });
  if (!limit.allowed) throw new HttpError(429, "rate_limited", limit.retryAfterSec);

  const { id } = await params;
  const rx = OBJECT_ID.test(id) ? await getRxForUser(new ObjectId(id), auth.user._id) : null;
  const file = rx ? await getDeps().files.get(rx.file.key, { maxBytes: RX_MAX_BYTES }) : null;
  if (!rx || !file) throw new HttpError(404, "not_found");

  await appendAudit({
    at: now,
    action: "rx.view",
    actor: { type: "user", userId: auth.user._id, role: auth.user.role },
    target: { type: "prescription", id },
  });
  const ext = rx.file.contentType === "application/pdf" ? "pdf" : "webp";
  const headers = sessionRefreshHeaders(auth);
  headers.set("Content-Type", rx.file.contentType);
  headers.set("Content-Length", String(file.body.byteLength));
  headers.set("Cache-Control", "private, no-store");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Content-Security-Policy", "sandbox; default-src 'none'; img-src 'self'");
  headers.set("Content-Disposition", `inline; filename="prescription.${ext}"`);
  headers.set("Cross-Origin-Resource-Policy", "same-origin");
  headers.set("Referrer-Policy", "no-referrer");
  return new Response(Buffer.from(file.body), { status: 200, headers });
});

/**
 * Next would answer HEAD from GET, writing an `rx.view` row for a response that sends no bytes.
 * The file is only ever fetched, so HEAD is refused.
 */
export function HEAD(): Response {
  return new Response(null, {
    status: 405,
    headers: { Allow: "GET", "Cache-Control": "no-store" },
  });
}
