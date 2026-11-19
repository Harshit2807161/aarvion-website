/**
 * Sign-up details for a first login [C5]. Login tests send them by default. Today the verify
 * body schema strips them; from 38c on, a verify for a new identifier needs them or answers 409
 * `signup_required`. An existing user's login ignores them (they are written on insert only).
 */
export const DEFAULT_SIGNUP = {
  name: "Test User",
  adult: true,
  termsPrivacy: true,
  marketing: false,
} as const;
