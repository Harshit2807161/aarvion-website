/**
 * Login copy and wait formatting: the customer-facing strings of the login flow (PRODUCT.md:
 * plain words, no blame), the client copies of the server's OTP limits, and the formatters that
 * turn a wait into words. Pure, no React. `login-machine.ts` re-exports everything here.
 * `login-copy.test.ts` pins the constants to the server's, so runtime code under
 * `src/components` never imports `src/server/**`.
 */

/** Client copies of OTP_MAX_ATTEMPTS, RESEND_AFTER_SEC and OTP_TTL_MS (pinned by the test). */
export const MAX_TRIES = 5;
export const RESEND_SEC = 30;
export const CODE_TTL_MS = 300_000;

/** Shown in place of a wait when the server sent none; no "NaN" may ever reach the screen. */
const SOME_WHILE = "a little while";
/** How long Verify stays blocked after a 429 that carried no usable wait. */
export const FALLBACK_LOCK_MS = 60_000;

export const LOGIN_COPY = {
  idTitle: "Sign in or create an account",
  idSub: "We’ll send you a 6-digit code. There’s no password.",
  // Added in Task 41, verbatim from design/prototype/pages/login.html: the visually hidden legend
  // of the Mobile/Email switch. Awaiting the owner's approval with nameRefused and nameTooLong.
  viaLegend: "Send the code to my",
  mobile: "Mobile",
  email: "Email",
  mobileLabel: "Mobile number",
  mobileHint: "Indian mobile numbers (+91) only.",
  mobileRequired: "Enter your 10-digit mobile number.",
  mobileInvalid: "Enter a 10-digit mobile number that starts with 6, 7, 8 or 9.",
  emailLabel: "Email address",
  emailRequired: "Enter your email address.",
  emailInvalid: "Enter an email address like name@example.com.",
  send: "Send code",
  sending: "Sending code…",
  codeTitle: "Enter the code",
  codeSent: "We sent a 6-digit code to",
  change: "Change",
  codeLabel: "6-digit code",
  codeHint: "The code works for 5 minutes. You can paste it.",
  resendIn: "Resend code in",
  resend: "Send a new code",
  verify: "Verify and sign in",
  verifying: "Checking…",
  incomplete: "Enter all 6 digits of the code.",
  wrong: (n: number) => `That code doesn’t match. ${n} ${n === 1 ? "try" : "tries"} left.`,
  lockedWait: (t: string) =>
    `Too many wrong codes, so this code no longer works. You can ask for a new one in ${t}.`,
  lockedReady: "Too many wrong codes, so this code no longer works. Ask for a new one below.",
  expired: "This code has expired. Ask for a new one.",
  daily: (what: "number" | "email", wait: string) =>
    `Too many wrong codes for this ${what} today. Try again in ${wait}.`,
  rateLimited: (t: string) => `Too many codes requested. Try again in ${t}.`,
  verifyRateLimited: (t: string) => `Too many attempts from this network. Try again in ${t}.`,
  deliveryFailed: (channel: "phone" | "email") =>
    `We couldn’t send the code. Try again, or use ${channel === "phone" ? "your email" : "your mobile number"} instead.`,
  network: "Something went wrong. Check your connection and try again.",
  profileTitle: "Create your account",
  profileSub: "is verified. One more step and you’re in.",
  nameLabel: "Full name",
  nameInvalid: "Enter the full name, at least 2 letters.",
  // Added in Task 40: a name over the server's 80 characters is not an "at least 2 letters" problem.
  nameTooLong: "Enter a name of 80 characters or fewer.",
  // Added in Task 40 (Task 39 review carry a): the server refused the name we sent, which the
  // client checks cannot always predict (the client mirrors the server's name rule, so this is rare).
  nameRefused: "Enter your name using letters only.",
  adult: "I am 18 or older",
  adultRequired: "Confirm that you are 18 or older to create an account.",
  terms: "I agree to the Terms of use and the Privacy policy",
  termsRequired: "Agree to the Terms of use and the Privacy policy to create an account.",
  marketing: "Tell me about new Aarvion medicines",
  marketingSub: "Optional. By SMS and email. Change it any time in your account.",
  create: "Create account",
  creating: "Creating your account…",
  doneTitle: "You’re signed in",
  doneCheckout: "Taking you to checkout…",
  doneDefault: "One moment…",
  shield: "We use your number or email to sign you in and to send updates about your orders.",
  newCodeToast: (to: string) => `New code sent to ${to}`,
  signedInToast: (first: string | null) => (first ? `Signed in as ${first}` : "Signed in"),
} as const;

/** A finite, non-negative whole number of seconds (rounded up), or null for anything else. */
export function wholeSec(sec: number | undefined): number | null {
  return typeof sec === "number" && Number.isFinite(sec) && sec >= 0 ? Math.ceil(sec) : null;
}

/** 30 -> "0:30", 125 -> "2:05". A missing or non-finite wait reads "a little while". */
export function mmss(sec: number | undefined): string {
  const s = wholeSec(sec);
  if (s === null) return SOME_WHILE;
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** Long waits in words, rounded up: 1500 -> "25 minutes", 3600 -> "1 hour", 10_800 -> "3 hours". */
export function waitText(sec: number | undefined): string {
  const s = wholeSec(sec);
  if (s === null) return SOME_WHILE;
  if (Math.ceil(s / 60) < 60) {
    const m = Math.max(1, Math.ceil(s / 60));
    return `${m} ${m === 1 ? "minute" : "minutes"}`;
  }
  const h = Math.ceil(s / 3600);
  return `${h} ${h === 1 ? "hour" : "hours"}`;
}
