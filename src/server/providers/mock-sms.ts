import { writeOutbox } from "./outbox.ts";
import type { SmsProvider } from "./types.ts";

export const mockSms: SmsProvider = {
  send: (msg) => writeOutbox("sms", msg.to, { templateId: msg.templateId, vars: msg.vars }),
};
