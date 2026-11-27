import { connection } from "next/server";
import { requireUser, sessionRefreshHeaders } from "@/server/auth/guards";
import { toPublicUser } from "@/server/auth/users";
import { jsonResponse, withErrors } from "@/server/http";

export const GET = withErrors(async (req) => {
  await connection();
  const auth = await requireUser(req);
  return jsonResponse({ user: toPublicUser(auth.user) }, { headers: sessionRefreshHeaders(auth) });
});
