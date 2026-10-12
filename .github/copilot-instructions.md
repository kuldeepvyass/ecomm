# Copilot instructions — Maison Horlogère

Before changing anything, read `docs/PROJECT_CONTEXT.md` (owner's rules, local setup, architecture, known traps),
then `README.md` and `PROGRESS.md`. Treat `docs/PROJECT_CONTEXT.md` as standing instructions; keep it and
`PROGRESS.md` updated when things change.

Key rules (full list in docs/PROJECT_CONTEXT.md):
- Next.js 16 differs from older versions: check `node_modules/next/dist/docs/` before using an API
  (`proxy.ts` not middleware, async params, `revalidateTag(tag, "max")`).
- Payments are UPI-only with manual UTR verification — never add a payment gateway or Cash on Delivery.
  Refunds go by bank transfer.
- Never use or store the owner's personal email anywhere (code, data, docs, commits).
- No test accounts or one-click sign-in (removed on purpose). The only admin is the `ADMIN_EMAILS` address.
- Prisma migrations are written by hand (see docs/PROJECT_CONTEXT.md); restart the dev server after `prisma generate`.
- The catalogue lives in `prisma/data/catalog.json`; refresh with `npm run catalog:export` and commit.
  Never put cost prices, users or orders in it (the repo is public).
- Mobile first: the owner tests on a 384 px-wide Android phone — no horizontal overflow
  (use `grid-cols-1` / `minmax(0,1fr)` and `min-w-0` on grids).
- Check work with `npx tsc --noEmit`, `npm run lint`, `npx vitest run`. Run `npm run test:e2e` only when asked.
- Commit (as the repo-local noreply identity) and push only when the owner asks.
- Local: `./scripts/setup-local.sh <admin-email>` then `npm run dev -- -p 3100`. Deploy: `./deploy.sh` (README §5).
- Explain results in plain language; the owner is not a developer-tools expert.
