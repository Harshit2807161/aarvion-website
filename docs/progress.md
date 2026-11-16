# Aarvion: running progress log

The owner (2026-11-16) said: "go with the best design and go on with the website design, don't stop till you have finished… follow the plan… I will take a look tomorrow." They also said: "you may merge PRs as well, I want the codebase to be up to date too."

The plan is at `/Users/harshi/.claude/plans/pasted-content-id-83b6-leave-them-misty-micali.md`. Design work follows Impeccable (`~/.claude/skills/impeccable`) and Emil Kowalski's skills (`~/.claude/skills/emil-design-eng`, `animate`, …).

## Done
- [x] Stage 0: data, docs and photos (`data/products.json`, `docs/catalogue.md`, `docs/missing-products.md`)
- [x] Stage 1: requirements v0.1 (`docs/requirements.md`); the owner accepted the proposed defaults ("go with your picks")
- [x] Stack: Next.js 16 App Router + TypeScript (owner's choice)
- [x] Impeccable `PRODUCT.md` written (inferred fields labelled)
- [x] Direction round 1 (`docs/design/direction-round-1.md`): comps in `.impeccable/mocks/decision/{assigned,pick,canon}.png`
- [x] Chosen: **"The Strip"** (forest green + white, foil strip with dot-matrix MRP stamps). Code-led build. Surface brief: `.impeccable/surfaces/design-prototype-index-html.md`

## Next
1. Build the home prototype at `design/prototype/index.html` (builder subagent).
2. Finish review (fresh reviewer), one fix round, then DESIGN.md + `.impeccable/design.json` (documenter).
3. Hi-fi prototypes of the remaining pages, inside the world: category, product, search, login/OTP, cart, checkout, order, account, admin.
4. Stack gate: record the recommended defaults (native mongodb driver + zod, MSG91, Resend, Vercel Blob private, DB sessions, Tailwind 4 + shadcn) as decided-by-delegate.
5. Build PR by PR in `Harshit2807161/aarvion-website`; merge each PR after its checks pass.

## Tools
- Screenshots: `node .tools/shoot.mjs <file> <out-prefix> 1440,390 [--viewport-only]` (playwright-core + cached headless Chrome).
- Product cutouts (transparent): `assets/products/cutout/<slug>.webp`. Logo SVGs: `assets/brand/`.
- ₹-safe fonts: Host Grotesk, Geist, Geist Mono, Schibsted Grotesk, Bricolage Grotesque, Familjen Grotesk, Manrope, Figtree, Inter. **Sora has no ₹.**
- Composio Gemini image is disabled; image generation goes through the Figma MCP `generate_image` (file `dlvnZAbqR9Vbnk3Sg7Eixi`, which costs the owner's credits).
