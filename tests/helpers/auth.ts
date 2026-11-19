/**
 * Sign-up details for a first login [C5]. Login tests send them by default, so a new user is
 * created with this name and consent; from 38c on, a verify for a new identifier needs them or
 * answers 409 `signup_required`. An existing user's login ignores them (insert only).
 */
export const DEFAULT_SIGNUP = {
  name: "Test User",
  adult: true,
  termsPrivacy: true,
  marketing: false,
} as const;
