// Import every module that calls registerIndexes, so scripts can ensure all indexes.
import "../providers/outbox.ts";
import "../catalogue/collections.ts";
import "../security/rate-limit.ts";
import "../auth/otp.ts";
import "../auth/users.ts";
import "../auth/sessions.ts";
import "../audit.ts";
