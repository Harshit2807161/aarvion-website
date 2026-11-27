/**
 * Fired on `window` once a shopper has signed in, whichever way they did: the login dialog
 * (`AccountPill`) or the /login page (`LoginFlow`, right before it navigates). The page keeps its
 * layout across a soft navigation, so listeners such as the cart store's sign-in cannot rely on a
 * remount to find out. `LOGIN_EVENT` (account-pill.tsx) only asks for the dialog to open.
 */
export const SIGNED_IN_EVENT = "aarv:signed-in";

export function announceSignedIn(): void {
  window.dispatchEvent(new Event(SIGNED_IN_EVENT));
}
