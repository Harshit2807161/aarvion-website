/**
 * Sign-up details for a first login [C5]. Login tests send them by default, so a verify for a
 * new identifier creates the user instead of answering 409 `signup_required`; an existing
 * user's login ignores them (they are written on insert only).
 */
export const DEFAULT_SIGNUP = {
  name: "Test User",
  adult: true,
  termsPrivacy: true,
  marketing: false,
} as const;
