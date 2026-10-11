# Maison Horlogère — project context for Claude

Read this before changing anything. It records the owner's decisions, how the code is organised and
the traps already found. `PROGRESS.md` is the changelog; `README.md` is the operator guide.

## What this is
A mobile-first luxury watch store for India (₹, GST, PIN codes), live-ready at v1.0.0 (git tag).
Next.js 16 App Router · TypeScript · Tailwind 4 · Framer Motion · Prisma 7 + PostgreSQL 17 · Auth.js v5 ·
React Email · deployed to a Hostinger VPS with `./deploy.sh`.

## Owner's rules (non-negotiable unless the owner says otherwise)
- **Payments: UPI only, no gateway** (no Razorpay/Stripe — fees). Customer pays the store's UPI ID, submits the
  12-digit UTR + the UPI ID they paid from; admin confirms manually in Admin → Payments. **No Cash on Delivery.**
- **Refunds go by bank transfer** (UPI caps ~₹1 lakh/day): customer gives account holder, number (×2), IFSC, bank;
  admin sends it and records the reference; full account number is erased after sending (last 4 kept).
- **Catalogue under ₹1 lakh.** Product photos are **links** (hotlinked, never downloaded to the server).
- **Never use or store the owner's personal email** anywhere (code, seed, env, DB, docs, commits). Admin for
  The only admin is the address the owner puts in `ADMIN_EMAILS`. Commit as the repo-local
  `kuldeepvyass@users.noreply.github.com`.
- **Don't run the Playwright E2E suite unless the owner asks** (they batch changes); run typecheck, lint and
  Vitest instead. When E2E is requested, run it last, before pushing.
- Default theme is **light**. Default listing sort is **Recommended** (premium analog first).
- The owner tests on an **Android phone (Galaxy S24 Ultra, 384 px wide)** — always check 384 px for overflow.
- Explain results in plain language; the owner is not a developer-tooling expert.

## Local setup (macOS)
```bash
brew install node@24 postgresql@17          # Node 24 matches production
git clone https://github.com/kuldeepvyass/ecomm.git luxury-watch-store && cd luxury-watch-store
npm install

# Postgres on port 5433 with the data folder inside the project (git-ignored)
export PATH="/opt/homebrew/opt/postgresql@17/bin:$PATH"
LC_ALL=en_US.UTF-8 initdb -D .pgdata -U postgres --auth=trust
LC_ALL=en_US.UTF-8 pg_ctl -D .pgdata -l .pgdata/server.log -o "-p 5433 -k /tmp" start
createdb -h /tmp -p 5433 -U postgres maison
createdb -h /tmp -p 5433 -U postgres maison_test
createdb -h /tmp -p 5433 -U postgres maison_e2e
```
Create `.env` (git-ignored):
```
DATABASE_URL="postgresql://postgres@localhost:5433/maison"
DIRECT_URL="postgresql://postgres@localhost:5433/maison"
AUTH_SECRET="<run: openssl rand -base64 32>"
NEXT_PUBLIC_SITE_URL="http://localhost:3100"
ADMIN_EMAILS="<the owner's admin address — ask them>"
NEXT_PUBLIC_APK_URL="/downloads/maison-horlogere.apk"
```
Leave `AUTH_URL` unset locally (Auth.js then uses the request host, so a phone on the LAN can sign in).
Create `.env.test` (git-ignored) with the same two URLs pointing at `maison_test`. `.env.e2e` is committed.

**Data — pick one:**
- Restore the owner's snapshot (246 watches, collections, banners, hero video, featured picks; no users or orders):
  `npx prisma migrate deploy && pg_restore --clean --if-exists --no-owner -d "postgresql://postgres@localhost:5433/maison" maison-dev-db-2026-10-11.dump`
  then `npx prisma migrate deploy` again (applies anything newer than the snapshot).
- Or start fresh: `npx prisma migrate deploy && SEED_DEMO=0 npx prisma db seed`, then Admin → Import the owner's CSV
  (`top246_watches_final.csv`, kept outside the repo).

Then `npm run dev -- -p 3100` → http://localhost:3100. LAN: `http://<mac-ip>:3100` (`ipconfig getifaddr en0`).
Port 3000 is used by another project on the owner's machine — use 3100.

**Signing in locally:** there are no test accounts (removed at the owner's request). Sign in at `/sign-in` with any
email — without SMTP configured, the one-time code email is captured to `.dev-mail/` and shown at `/dev/mail`.
The `ADMIN_EMAILS` address becomes admin on sign-in. For a customer, use any other address.

## Commands
| | |
|---|---|
| `npx tsc --noEmit` · `npm run lint` | typecheck · lint (0 errors expected; ~9 known warnings) |
| `npx vitest run` | unit + integration (integration uses `maison_test`) — 58 tests |
| `npm run test:e2e` | Playwright, 96 tests (iPhone 14, Pixel 7, desktop + axe); builds into `.next-e2e`, DB `maison_e2e`, port 3200 — only when asked |
| `./deploy.sh [setup\|copy-catalog\|rollback\|status\|logs\|backup\|ssh]` | production (see README §5) |

## Where things are
- `prisma/schema.prisma`, `prisma/migrations/` — **write migrations by hand** (`migrate dev` is interactive and
  `migrate reset` is blocked for AI): `npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script`,
  put the SQL in a new timestamped folder, then `DATABASE_URL=… npx prisma migrate deploy` for `maison` and
  `maison_test`, then `npx prisma generate` and **restart the dev server** (stale client → "Unknown argument").
  `Product.rankScore` is a Postgres GENERATED column (default sort) — never write it.
- `prisma/seed.ts` + `seed-data.ts` — settings, zones, coupons, collections, banners, admin users from `ADMIN_EMAILS`, demo catalogue (`SEED_DEMO=0` skips).
- `src/server/orders/service.ts` — order placement, UTR submission/confirmation, expiry, cancellation, refunds (bank details).
- `src/server/catalog/` — queries (filters, facets, sorting), admin writes, CSV/XLSX importer (`import.ts`).
- `src/lib/catalog/classify.ts` — normalises dataset text (movement, watch type, strap type, water resistance…).
- `src/app/(store)/` storefront · `src/app/admin/` admin · `src/server/actions/` server actions.
- `src/components/listing/filters.tsx` — price slider + collapsible filter sections.
- `src/lib/email/send.ts` — SMTP (Hostinger) → Resend → dev mailbox.
- `src/server/uploads.ts` — images on disk in `UPLOAD_DIR` (dev `.media/`), served at `/media/` (Nginx in prod).
- `deploy.sh`, `deploy/` — VPS deployment (bash 3.2-compatible for macOS).

## Traps already hit (don't repeat)
- **Next.js 16 is not the Next you know** — read `node_modules/next/dist/docs/` before using an API. `proxy.ts`
  replaced middleware; params are async; `revalidateTag(tag, "max")`; `priority` → `loading="eager"` + `fetchPriority`.
- Data changed **directly in the DB** doesn't show until caches refresh: restart dev and delete
  `.next/dev/cache/fetch-cache`; on the server `copy-catalog` calls `/api/internal/revalidate`.
- Grids on mobile need `grid-cols-1` / `minmax(0,1fr)` + `min-w-0`, or wide content stretches the page (zoom bug).
- `"use client"` modules can't export constants to server components (you get a client reference, not the value).
- React lint forbids `setState` in effects → use `useSyncExternalStore` for browser-only values.
- Forms that update several fields asynchronously: use functional `setState` updaters.
- `dotenv` v17 prints to stdout unless `quiet: true`; it never overrides existing env vars.
- macOS `sed` doesn't understand `\t` (use perl); macOS bash is 3.2 (no associative arrays).
- Deploy scripts: after editing `deploy/` or `deploy.sh`, run shellcheck **and** rehearse on a throwaway Ubuntu
  VM (`brew install lima && limactl start --name=vps template:ubuntu-24.04`), as root and as a sudo user.
- The owner's personal email must never appear — grep before committing.

## Status
v1.0.0 is deployment-ready; nothing deployed yet (the owner fills `.env.production` on deployment day).
Pending from the owner: their APK (→ `public/downloads/maison-horlogere.apk`), store UPI ID, domain, mailbox.
Test accounts and the one-click sign-in were removed (2026-10-11); don't reintroduce them unless asked.
