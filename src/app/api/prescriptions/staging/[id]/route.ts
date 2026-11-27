import { createHash } from "node:crypto";
import { requireUser, sessionRefreshHeaders } from "@/server/auth/guards";
import { getDeps } from "@/server/deps";
import { HttpError, readCappedBytes, withErrors } from "@/server/http";
import { RX_MAX_BYTES } from "@/server/prescriptions/file-check";
import { peekStaging } from "@/server/prescriptions/prescriptions";
import { FileExistsError } from "@/server/providers/file-keys";
import { assertSameOrigin } from "@/server/security/origin";

const STAGING_ID = /^[A-Za-z0-9_-]{22}$/;
const sha256 = (b: Uint8Array) => createHash("sha256").update(b).digest("hex");

type Ctx = { params: Promise<{ id: string }> };

/**
 * `PUT /api/prescriptions/staging/[id]`: the raw file bytes for the caller's live slot (dev and
 * e2e only: under `FILE_STORE=blob` the browser uploads to Blob and this answers 404). 204 on
 * success; 404 for a slot that is missing, expired or another user's; 413 `file_too_large` over
 * 8 MiB; 400 `invalid_file` for an empty body. The bytes are checked only at finalise. A repeat of
 * the same bytes (a retried PUT) is 204; different bytes for a filled slot are 409.
 */
export const PUT = withErrors<[Ctx]>(async (req, { params }) => {
  assertSameOrigin(req);
  const { files } = getDeps();
  if (files.kind === "blob") throw new HttpError(404, "not_found");
  const auth = await requireUser(req);
  const { id } = await params;
  const slot = STAGING_ID.test(id) ? await peekStaging(id, auth.user._id, getDeps().now()) : null;
  if (!slot) throw new HttpError(404, "not_found");

  let bytes: Uint8Array;
  try {
    bytes = await readCappedBytes(req, RX_MAX_BYTES);
  } catch (e) {
    if (e instanceof HttpError && e.status === 413) throw new HttpError(413, "file_too_large");
    throw e;
  }
  if (bytes.byteLength === 0) throw new HttpError(400, "invalid_file");
  try {
    await files.put(slot.key, bytes, "application/octet-stream");
  } catch (e) {
    if (!(e instanceof FileExistsError)) throw e;
    const existing = await files.get(slot.key, { maxBytes: RX_MAX_BYTES });
    if (!existing || sha256(existing.body) !== sha256(bytes)) {
      throw new HttpError(409, "already_uploaded");
    }
  }
  // Re-issue the sliding cookie like every customer route (carry K1).
  const headers = sessionRefreshHeaders(auth);
  headers.set("Cache-Control", "no-store");
  return new Response(null, { status: 204, headers });
});
