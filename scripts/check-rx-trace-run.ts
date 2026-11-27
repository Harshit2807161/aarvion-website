// Entry for `pnpm check:rx-trace` (see check-rx-trace.ts). It runs unconditionally, so it can never
// exit 0 without checking.
import { checkRxTrace, RX_TRACED_ROUTES } from "./check-rx-trace.ts";

const problems = checkRxTrace(process.cwd());
for (const p of problems) console.error(`rx trace check: ${p}`);
if (problems.length > 0) process.exit(1);
console.log(`rx trace check: ${RX_TRACED_ROUTES.length} routes ship pdf-lib, sharp and the worker`);
