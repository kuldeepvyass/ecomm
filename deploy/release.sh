#!/usr/bin/env bash
# Builds one release on the server (run by ./deploy.sh as the app user, inside the new release folder).
# The live site keeps serving the previous release until deploy.sh switches the `current` link.
#   usage: release.sh <release-dir> <shared-dir>
set -Eeuo pipefail
REL="$1"
SHARED="$2"
cd "$REL"

step() { printf '\n\033[1;33m▸ %s\033[0m\n' "$*"; }

# Runtime settings live in shared/ so every release uses the same ones.
ln -sfn "$SHARED/.env" .env
export NEXT_TELEMETRY_DISABLED=1
export npm_config_cache="$HOME/.npm"

step "Installing packages"
# Strict install from package-lock.json. A lock file written on macOS can lack a few Linux-only
# optional packages (npm records only the current platform's); in that one case, fall back to
# `npm install`, which keeps every locked version and adds just the missing platform packages.
if ! npm ci --include=dev --no-audit --no-fund --loglevel=error 2> npm-ci.log; then
  if grep -q "can only install packages when your package.json and package-lock.json" npm-ci.log; then
    echo "  lock file is missing Linux-only packages — installing with npm install (locked versions kept)"
    npm install --include=dev --no-audit --no-fund --no-save --loglevel=error
  else
    cat npm-ci.log >&2
    exit 1
  fi
fi
rm -f npm-ci.log

step "Applying database migrations"
npx prisma migrate deploy

if [ ! -f "$SHARED/.seeded" ]; then
  step "First deploy: store settings, shipping zones, coupons, collections, banners, admin accounts"
  # No demo catalogue in production.
  SEED_DEMO=0 NODE_ENV=production npx prisma db seed
  touch "$SHARED/.seeded"
fi

step "Building (this takes a few minutes)"
NODE_OPTIONS="--max-old-space-size=3072" npm run build

echo "$(basename "$REL")" > .release
printf '\n\033[32mRelease %s built.\033[0m\n' "$(basename "$REL")"
