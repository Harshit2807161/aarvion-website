/**
 * Customer-facing strings of the prescription upload form and its client. Pure, no React, and
 * imported only by the lazy upload surfaces (never by first-load code).
 *
 * Verbatim from the design prototype (design/prototype/pages/account.html and js/flows.js) where
 * it has the string. The entries marked NEW are not in the prototype and wait for the owner's
 * approval like every new customer string (listed in the R6 PR).
 * `declaration` repeats the server's `RX_DECLARATION_TEXT`; rx-upload-form.test.tsx pins the two,
 * so runtime code under src/components never imports src/server/**.
 */
import { LOGIN_COPY } from "@/components/auth/login-copy";

/** The prototype's size wording (flows.js `mb`): 1.8 MB from 1 MiB up, else whole KB (at least 1). */
export function fileSize(bytes: number): string {
  return bytes >= 1_048_576
    ? `${(bytes / 1_048_576).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export const RX_COPY = {
  dropTitleFine: "Drag your prescription here",
  dropTitleCoarse: "Add your prescription",
  dropHint: "A clear photo or scan of the whole page. JPG, PNG, WebP or PDF, up to 8 MB.",
  pick: "Choose a file",
  camera: "Take a photo",
  patientLabel: "Patient’s name",
  patientHint: "As written on the prescription.",
  patientRequired: "Enter the patient’s name as written on the prescription.",
  // NEW: the server's name rule (2 to 80 characters with a letter), worded like LOGIN_COPY's.
  patientInvalid: "Enter the patient’s name, at least 2 letters.",
  patientTooLong: "Enter a name of 80 characters or fewer.",
  declaration:
    "This is a valid prescription from a registered doctor, written for the patient named above.",
  declarationRequired: "Confirm the prescription is valid to continue.",
  fileRequired: "Add a photo or PDF of the prescription.",
  unsupported: (name: string) => `“${name}” can’t be used. Choose a JPG, PNG, WebP or PDF file.`,
  tooLarge: (name: string, size: string) =>
    `“${name}” is ${size}. Files can be up to 8 MB; try a smaller photo or a PDF.`,
  // The prototype's `say()` lines (flows.js Upload), spoken through #live.
  added: (name: string) => `${name} added.`,
  removed: "File removed.",
  remove: (name: string) => `Remove ${name}`,
  ready: (size: string) => `${size} · ready to send`,
  submit: "Send for review",
  sending: "Sending…",
  cancel: "Cancel",
  sent: "Prescription sent for review.",
  corrupt: "We couldn’t read this file. Try another photo or a PDF.",
  tooSmall: "This photo is too small to read. Take a closer photo of the whole page.",
  animated: "Upload a still photo, not an animation.",
  tooManyPages: "This PDF has more than 20 pages. Upload only the prescription pages.",
  pdfBlocked: "This PDF can’t be checked here. Upload a photo, or a PDF without a password.",
  expired: "The upload took too long. Try again.",
  rateLimited: (t: string) => `Too many uploads. Try again in ${t}.`,
  network: LOGIN_COPY.network,
  // NEW: the server's PDF check stayed busy through the automatic retries (503 busy).
  busy: "We couldn’t check your file just now. Try again in a minute.",
  // NEW: 500 upload_unconfirmed. The record may exist, so the shopper must not simply resend.
  unconfirmed: (t: string) =>
    `We couldn’t confirm your upload. Wait ${t}, then send it again or check your prescriptions.`,
  // NEW: a 401 on send. The sign-in dialog opens and the chosen file stays.
  signIn: "Sign in to send your prescription. Your file is still here.",
} as const;
