import { writeOutbox } from "./outbox.ts";
import type { EmailProvider } from "./types.ts";

export const mockEmail: EmailProvider = {
  send: (msg) =>
    writeOutbox("email", msg.to, { subject: msg.subject, html: msg.html, text: msg.text }),
};
