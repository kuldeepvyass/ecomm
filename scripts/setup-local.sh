#!/bin/bash
# ═══ One-command local setup — macOS, or Windows via WSL2 (Ubuntu), or Ubuntu ══════
#   ./scripts/setup-local.sh                    (asks for the admin email)
#   ./scripts/setup-local.sh you@example.com    (or pass it)
#
# Installs what's missing (Node 24, PostgreSQL 17 — Homebrew on macOS, apt on Ubuntu/WSL), creates the local databases in ./.pgdata
# (port 5433), writes .env and .env.test, installs packages, applies migrations and loads the store's
# catalogue (prisma/data/catalog.json). Safe to re-run: existing .env files and data are kept.
# Then: npm run dev -- -p 3100
set -Eeuo pipefail
cd "$(dirname "$0")/.."

PG_PORT="${PG_PORT:-5433}"
ADMIN_EMAIL="${1:-}"

step() { printf '\n\033[1;36m━━ %s\033[0m\n' "$*"; }
ok()   { printf '  \033[32m✓\033[0m %s\n' "$*"; }
warn() { printf '  \033[33m!\033[0m %s\n' "$*"; }
die()  { printf '\n\033[31m✗ %s\033[0m\n' "$*" >&2; exit 1; }

# shellcheck source=scripts/lib-platform.sh
. scripts/lib-platform.sh
platform_check

step "Tools"
if [ "$(node_major)" -lt 24 ] 2>/dev/null; then install_node; fi
ok "node $(node -v)"
find_pgbin || install_pg
find_pgbin || die "PostgreSQL 17 didn't install — see the messages above."
ok "PostgreSQL $("$PGBIN/postgres" --version | awk '{print $3}')"
command -v openssl >/dev/null || die "openssl is required (it's preinstalled on macOS and Ubuntu)."

step "Database (port $PG_PORT, data in ./.pgdata)"
export LC_ALL="$PG_LOCALE"
if [ ! -f .pgdata/PG_VERSION ]; then
  "$PGBIN/initdb" -D .pgdata -U postgres --auth=trust >/dev/null
  ok "created ./.pgdata"
fi
if ! "$PGBIN/pg_isready" -q -h /tmp -p "$PG_PORT"; then
  "$PGBIN/pg_ctl" -D .pgdata -l .pgdata/server.log -o "-p $PG_PORT -k /tmp" -w start >/dev/null
fi
ok "running"
for db in maison maison_test maison_e2e; do
  "$PGBIN/psql" -h /tmp -p "$PG_PORT" -U postgres -tAc "select 1 from pg_database where datname='$db'" | grep -q 1 \
    || "$PGBIN/createdb" -h /tmp -p "$PG_PORT" -U postgres "$db"
done
ok "databases: maison (dev), maison_test (Vitest), maison_e2e (Playwright)"

step "Settings (.env, .env.test)"
URL="postgresql://postgres@localhost:$PG_PORT/maison"
if [ -f .env ]; then
  ok ".env exists — kept as is"
else
  if [ -z "$ADMIN_EMAIL" ] && [ -t 0 ]; then
    read -r -p "  Admin email (signs in to the Admin panel; leave blank to add later): " ADMIN_EMAIL
  fi
  cat > .env <<EOF
# Local development — see .env.example for every variable. Never commit this file.
DATABASE_URL="$URL"
DIRECT_URL="$URL"
AUTH_SECRET="$(openssl rand -base64 32)"
# AUTH_URL is left unset locally so sign-in also works from a phone on your Wi-Fi.
NEXT_PUBLIC_SITE_URL="http://localhost:3100"
# The store admin: sign in with this address to get the Admin panel. Locally the sign-in code
# appears at http://localhost:3100/dev/mail (no email server needed). Comma-separate to add more.
ADMIN_EMAILS="$ADMIN_EMAIL"
# Shows the header "App" button once public/downloads/maison-horlogere.apk exists.
NEXT_PUBLIC_APK_URL=""
EOF
  ok "wrote .env${ADMIN_EMAIL:+ (admin: $ADMIN_EMAIL)}"
  [ -n "$ADMIN_EMAIL" ] || warn "ADMIN_EMAILS is blank — add your address to .env before signing in as admin"
fi
if [ ! -f .env.test ]; then
  printf 'DATABASE_URL="postgresql://postgres@localhost:%s/maison_test"\nDIRECT_URL="postgresql://postgres@localhost:%s/maison_test"\n' "$PG_PORT" "$PG_PORT" > .env.test
  ok "wrote .env.test"
fi

step "Packages"
npm install --no-audit --no-fund --loglevel=error
ok "installed"

step "Migrations and data"
npx prisma migrate deploy >/dev/null
DATABASE_URL="postgresql://postgres@localhost:$PG_PORT/maison_test" DIRECT_URL="postgresql://postgres@localhost:$PG_PORT/maison_test" npx prisma migrate deploy >/dev/null
ok "schema up to date (dev + test databases)"
SEED_DEMO=0 npx prisma db seed 2>&1 | grep -E "Catalogue loaded|Seed complete" | sed 's/^/  /' || true
ok "$("$PGBIN/psql" -h /tmp -p "$PG_PORT" -U postgres -d maison -tAc 'select count(*) from "Product" where "deletedAt" is null') watches in the local store"

printf '\n\033[1m✓ Ready.\033[0m Start the site:  npm run dev -- -p 3100   → http://localhost:3100\n'
if [ "$IS_WSL" = "1" ]; then
  printf '  On your phone: needs WSL "mirrored" networking — see README §1 (Windows), then use your PC'"'"'s Wi-Fi IP:3100\n'
else
  printf '  On your phone (same Wi-Fi): http://%s:3100\n' "$(lan_ip)"
fi
printf '  After a restart, start the database again with:  npm run db:start\n'
