import { SESSION_COOKIE } from "../../src/server/auth/cookie";
import { createSession } from "../../src/server/auth/sessions";
import {
  findOrCreateUserByIdentifier,
  setUserRole,
  type Role,
  type UserDoc,
} from "../../src/server/auth/users";
import { getDeps } from "../../src/server/deps";

let counter = 0;

/**
 * Signs a user in without the OTP flow: finds or creates the user by phone through the real
 * `findOrCreateUserByIdentifier`, gives a staff role first (so the session is staff-kind), and
 * opens a real session. Returns the user and a `Cookie` header value for `getReq`/`jsonPost`.
 * Each call without a phone makes a new user. Uses `getDeps().now()`, so install the test clock first.
 */
export async function signedIn(
  opts: { role?: Role; phone?: string } = {},
): Promise<{ user: UserDoc; cookie: string }> {
  const now = getDeps().now();
  const phone = opts.phone ?? `+9198${String(10_000_000 + counter++).padStart(8, "0")}`;
  const { user: created } = await findOrCreateUserByIdentifier(
    { channel: "phone", value: phone },
    now,
  );
  let user = created;
  if (opts.role && opts.role !== user.role) {
    await setUserRole(user._id, opts.role, now);
    user = { ...user, role: opts.role };
  }
  const { token } = await createSession(user, now);
  return { user, cookie: `${SESSION_COOKIE}=${token}` };
}
