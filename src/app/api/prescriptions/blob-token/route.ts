import type { HandleUploadBody } from "@vercel/blob/client";
import { z } from "zod";
import { requireUser, sessionRefreshHeaders } from "@/server/auth/guards";
import { getDeps } from "@/server/deps";
import { requireEnv } from "@/server/env";
import { HttpError, jsonResponse, readJson, withErrors } from "@/server/http";
import { RX_MAX_BYTES } from "@/server/prescriptions/file-check";
import { peekStaging } from "@/server/prescriptions/prescriptions";
import { assertSameOrigin } from "@/server/security/origin";

/** What the browser may send in a client upload: the types the file check accepts, at most 8 MiB. */
const RX_UPLOAD_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
const STAGING_ID = /^[A-Za-z0-9_-]{22}$/;

/** The two events the Blob client sends here. Only the fields we read are checked. */
const Body = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("blob.generate-client-token"),
    payload: z.object({
      pathname: z.string(),
      clientPayload: z.string().nullable(),
      multipart: z.boolean(),
    }),
  }),
  // The payload passes through untouched: the SDK verifies the signature over the re-serialised body.
  z.object({ type: z.literal("blob.upload-completed"), payload: z.unknown() }),
]);

/**
 * `POST /api/prescriptions/blob-token` (FILE_STORE=blob only; 404 otherwise): the `handleUpload`
 * endpoint of `@vercel/blob/client`. A token request needs the Origin check, a session and the
 * caller's live staging slot as `clientPayload`, and the requested pathname must be exactly that
 * slot's key (else 403 `forbidden`): the token is pinned to that one pathname, the accepted image
 * and PDF types, 8 MiB, no random suffix, no overwrite, and the slot's own expiry, so it cannot
 * write any other key or outlive the slot. Blobs are private (the store is private; the client
 * asks for `access: "private"`). An upload-completed callback is signature-checked by the SDK and
 * otherwise ignored: finalising is the client's explicit `POST /api/prescriptions`.
 */
export const POST = withErrors(async (req) => {
  if (getDeps().files.kind !== "blob") throw new HttpError(404, "not_found");
  const body = await readJson(req, Body);
  const token = requireEnv("BLOB_READ_WRITE_TOKEN");
  const { handleUpload } = await import("@vercel/blob/client");

  if (body.type === "blob.upload-completed") {
    try {
      await handleUpload({
        request: req,
        token,
        body: body as HandleUploadBody,
        onBeforeGenerateToken: async () => {
          throw new HttpError(403, "forbidden");
        },
      });
    } catch {
      throw new HttpError(403, "forbidden"); // a missing or bad signature
    }
    return jsonResponse({ type: body.type, response: "ok" });
  }

  assertSameOrigin(req);
  const auth = await requireUser(req);
  const { pathname, clientPayload } = body.payload;
  const slot =
    clientPayload && STAGING_ID.test(clientPayload)
      ? await peekStaging(clientPayload, auth.user._id, getDeps().now())
      : null;
  if (!slot || pathname !== slot.key) throw new HttpError(403, "forbidden");

  const result = await handleUpload({
    request: req,
    token,
    body,
    onBeforeGenerateToken: async (requested) => {
      if (requested !== slot.key) throw new HttpError(403, "forbidden");
      return {
        allowedContentTypes: RX_UPLOAD_TYPES,
        maximumSizeInBytes: RX_MAX_BYTES,
        addRandomSuffix: false,
        allowOverwrite: false,
        validUntil: slot.expiresAt.getTime(),
      };
    },
  });
  // Re-issue the sliding cookie like every customer route (carry K1).
  return jsonResponse(result, { headers: sessionRefreshHeaders(auth) });
});
