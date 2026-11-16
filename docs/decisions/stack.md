# Stack decisions

Stage 4 choices. Each was delegated to the assistant by the owner ("you decide"), so they are recorded here as made on the owner's behalf and are open to revision.

| Area | Choice | Why |
| --- | --- | --- |
| Framework | Next.js 16 (App Router), React 19, TypeScript 6.0 | Decided stack. TS is held at 6.0.x because TS 7 lacks typescript-eslint support. |
| Database access | Native `mongodb` driver + `zod` validation | Small surface, no ORM lock-in; zod validates at the boundary. |
| SMS / email | MSG91 (SMS) and Resend (email), each behind an interface | Providers stay swappable and mockable in tests. |
| File storage | Vercel Blob (private) for prescription files | Private access fits Rx documents and sits next to the Vercel deploy. |
| Sessions | Database-backed sessions | Revocable server-side, no JWT secret-rotation concerns. |
| Rate limiting | MongoDB TTL-index limiter | No extra infrastructure; expiry handled by the database. |
| UI | Tailwind 4 + shadcn/ui | Arrives with the design-tokens PR. |
| Testing | Vitest, React Testing Library, mongodb-memory-server, MSW, Playwright | Unit, integration and end-to-end layers without a live database. |
| Runtime / tooling | Node 24, pnpm, TS 6.0 | Current LTS line; pnpm pinned via `packageManager`. |
