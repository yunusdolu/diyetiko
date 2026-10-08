<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Project notes

- Read `DESIGN.md` before touching UI and `README.md` for architecture, security model and content rules.
- Never invent credentials, testimonials, prices, statistics or addresses — use placeholders and add them to the README checklist.
- All SQL goes through `lib/db` (`asUser` / `asAnon` / `asService`) so RLS always applies; `service_role` is reserved for lead intake and rate limiting.
- Client data must never be sent to third-party AI services (the draft-translation action accepts public recipe/guide ids only).
- UI strings live in `messages/{tr,en,ar,fr}.json` (keep keys in parity); ar/fr health content needs native review.
- Before finishing: `pnpm typecheck && pnpm lint && pnpm test && pnpm build`, then `pnpm test:e2e`.
- Windows/Git Bash: prefix scripts that take URL paths with `MSYS_NO_PATHCONV=1`.
