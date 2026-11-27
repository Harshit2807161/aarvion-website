/**
 * Loads the header sign-in dialog on first use, so neither it nor the login flow is in any page's
 * first-load JS. One function, so tests can count the loads (`account-pill.test.tsx`).
 */
export const loadLoginDialog = () => import("./login-dialog").then((m) => m.LoginDialog);
