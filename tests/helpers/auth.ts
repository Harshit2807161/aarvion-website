/**
 * Sign-up details for a first login [C5]. Login tests send them by default, because a verify for
 * a new identifier needs them (without them it answers 409 `signup_required`); the new user is
 * created with this name and consent. An existing user's login ignores them (insert only).
 */
export const DEFAULT_SIGNUP = {
  name: "Test User",
  adult: true,
  termsPrivacy: true,
  marketing: false,
} as const;
