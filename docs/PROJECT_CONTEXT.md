# Maison Horlogère — project context for Claude

Read this before changing anything. (Claude loads it via CLAUDE.md; GitHub Copilot via .github/copilot-instructions.md.) It records the owner's decisions, how the code is organised and
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

## Local setup — one command (macOS, or Windows via WSL2/Ubuntu)
```bash
git clone https://github.com/kuldeepvyass/ecomm.git luxury-watch-store && cd luxury-watch-store
./scripts/setup-local.sh owner-admin@example.com     # ask the owner for their admin email
npm run dev -- -p 3100                                # http://localhost:3100 · LAN: http://<mac-ip>:3100
```
`setup-local.sh` (also `npm run setup:local`) installs Node 24 and PostgreSQL 17 via Homebrew if missing, creates
`./.pgdata` on **port 5433** with the databases `maison` (dev), `maison_test` (Vitest) and `maison_e2e` (Playwright),
writes `.env` (generated `AUTH_SECRET`, `ADMIN_EMAILS`) and `.env.test`, installs packages, applies migrations and
loads the store's catalogue. It's safe to re-run and never overwrites an existing `.env`. After a reboot:
`npm run db:start`. Port 3000 is used by another project on the owner's machine — use 3100.
**Windows:** the owner's other PC is Windows — everything runs inside **WSL2 Ubuntu** (README §1 "On Windows"): clone
into `~` (never `/mnt/c`; the script refuses), install with apt (the script does it, asking for the Linux password),
open the site in the Windows browser at localhost. Phone testing needs WSL "mirrored" networking (README).
`deploy.sh` runs unchanged from WSL. Verified on a fresh Ubuntu 24.04: setup, typecheck/lint/Vitest, site, full deploy.
Leave `AUTH_URL` unset locally (Auth.js then uses the request host, so a phone on the LAN can sign in).

**The catalogue lives in git:** `prisma/data/catalog.json` holds the real store — 246 watches, brands, collections
(Chronograph/Automatic/Swiss Made/Smartwatches + hidden Dress/Dive/Limited), homepage banners (hero video, Tissot
"For Him/For Her" tiles), featured picks. No users, orders, settings or cost prices (the repo is public).
`SEED_DEMO=0 npx prisma db seed` loads it into an **empty** database — `setup-local.sh` and the **first production
deploy** both do this automatically. After the owner changes the catalogue locally, run `npm run catalog:export`
and commit the file. (`SEED_DEMO` unset loads the 20 fictional demo watches instead — used only by the E2E suite.)

**Signing in locally:** there are no test accounts (removed at the owner's request). Sign in at `/sign-in` with any
email — without SMTP configured, the one-time code email is captured to `.dev-mail/` and shown at `/dev/mail`.
The `ADMIN_EMAILS` address becomes admin on sign-in. For a customer, use any other address.

## Commands
| | |
|---|---|
| `npm run typecheck` · `npm run lint` | typecheck (runs `next typegen` first — plain `tsc` fails on a fresh clone) · lint (0 errors; ~11 known warnings) |
| `npx vitest run` | unit + integration (integration uses `maison_test`) — 58 tests |
| `npm run catalog:export` | refresh `prisma/data/catalog.json` from the local DB (then commit) |
| `npm run db:start` / `db:stop` | local PostgreSQL |
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
- `deploy.sh` (from Mac/Linux, uploads the working tree) and `deploy/vps.sh` (runs ON the server, pulls from GitHub —
  the Windows path); both use `deploy/server-setup.sh` + `deploy/release.sh`.

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
- macOS `sed` doesn't understand `\t` (use perl); macOS bash is 3.2 (no associative arrays). Scripts must work on
  both macOS and Ubuntu/WSL (`scripts/lib-platform.sh`); keep LF line endings (`.gitattributes`).
- `tsc` alone fails on a fresh clone (Next's `PageProps`/`RouteContext` types are generated) — use `npm run typecheck`.
- Deploy scripts: after editing `deploy/` or `deploy.sh`, run shellcheck **and** rehearse on a throwaway Ubuntu
  VM (`brew install lima && limactl start --name=vps template:ubuntu-24.04`), as root and as a sudo user.
- The owner's personal email must never appear — grep before committing.

## Status
v1.0.0 is deployment-ready; nothing deployed yet. **The owner deploys from a Windows PC with no local setup**: use
`deploy/vps.sh` over SSH (README §5 "Deploying from Windows") — ask the owner for the VPS IP, root password or SSH
key, domain, mailbox (SMTP) address + password, Let's Encrypt email and admin email, then run it on the server.
Don't make them install WSL/Node or run the site locally unless they ask. (`./deploy.sh` is the Mac/Linux path.) On deployment day the owner gives you the VPS IP + SSH access,
domain, mailbox (SMTP) details and admin email: `cp .env.production.example .env.production`, fill it in, run
`./deploy.sh` (README §5). The first deploy loads the catalogue from `prisma/data/catalog.json` automatically.
Pending from the owner: their APK (→ `public/downloads/maison-horlogere.apk`), store UPI ID, domain, mailbox.
Test accounts and the one-click sign-in were removed (2026-10-11); don't reintroduce them unless asked.
