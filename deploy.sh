#!/bin/bash
# ═══ Maison Horlogère → Hostinger VPS ══════════════════════════════════════════
#
#   ./deploy.sh                 Deploy. The first run also sets up the server (Node 24, PostgreSQL 17,
#                               Nginx, HTTPS, firewall, backups). Later runs just ship the new code.
#   ./deploy.sh setup           Re-run server setup (e.g. after pointing DNS, to get HTTPS)
#   ./deploy.sh copy-catalog    Copy your local products/brands/collections/banners to the live
#                               store (only allowed while the live store has no products or orders)
#   ./deploy.sh rollback        Switch back to the previous release
#   ./deploy.sh status          Service status + health
#   ./deploy.sh logs            Follow the live server logs (Ctrl-C to stop)
#   ./deploy.sh backup          Back up the live database now and download it to ./backups/
#   ./deploy.sh ssh             Open a shell on the server
#
#   Options:  --skip-checks     Skip the local typecheck/lint/unit tests before deploying
#
# Settings come from .env.production (copy .env.production.example). Runs on macOS (its bash 3.2) and on
# Linux — including Windows via WSL2/Ubuntu. Needs this project's node_modules, ssh, rsync, curl, openssl.
set -Eeuo pipefail

cd "$(dirname "$0")"
ROOT="$PWD"
ENV_FILE="${ENV_FILE:-$ROOT/.env.production}"
APP_USER="maison"
KEEP_RELEASES=3

# ── output helpers ───────────────────────────────────────────────────────────
bold() { printf '\033[1m%s\033[0m\n' "$*"; }
step() { printf '\n\033[1;36m━━ %s\033[0m\n' "$*"; }
ok()   { printf '  \033[32m✓\033[0m %s\n' "$*"; }
warn() { printf '  \033[33m!\033[0m %s\n' "$*"; }
die()  { printf '\n\033[31m✗ %s\033[0m\n' "$*" >&2; exit 1; }
trap 'die "Deploy stopped at line $LINENO. Nothing was switched — the live site is unchanged unless noted above."' ERR

# ── arguments ────────────────────────────────────────────────────────────────
CMD="deploy"
SKIP_CHECKS=0
for a in "$@"; do
  case "$a" in
    deploy|setup|copy-catalog|rollback|status|logs|backup|ssh) CMD="$a" ;;
    --skip-checks) SKIP_CHECKS=1 ;;
    -h|--help) sed -n '2,22p' "$0"; exit 0 ;;
    *) die "Unknown option: $a  (see ./deploy.sh --help)" ;;
  esac
done

# ── settings ─────────────────────────────────────────────────────────────────
[ -f "$ENV_FILE" ] || die "Missing .env.production — run:  cp .env.production.example .env.production  and fill it in."
[ -d node_modules ] || die "Run ./scripts/setup-local.sh (or npm install) once on this computer first — the deploy helper uses it."
for t in ssh rsync curl openssl perl; do
  command -v "$t" >/dev/null || die "'$t' is missing on this computer. Ubuntu/WSL: sudo apt-get install -y openssh-client rsync curl openssl perl"
done

load_env() { eval "$(node deploy/env.mjs shell "$ENV_FILE")"; }
set_env() { node deploy/env.mjs set "$ENV_FILE" "$1" "$2"; }
load_env

DEPLOY_USER="${DEPLOY_USER:-root}"
DEPLOY_SSH_PORT="${DEPLOY_SSH_PORT:-22}"
DEPLOY_PATH="${DEPLOY_PATH:-/var/www/maison}"
APP_PORT="${APP_PORT:-3000}"
DOMAIN_WWW="${DOMAIN_WWW:-true}"

missing=""
for v in DEPLOY_HOST DOMAIN; do [ -n "${!v:-}" ] || missing="$missing $v"; done
[ -z "$missing" ] || die "Fill in .env.production:$missing"
case "$DOMAIN" in http*|*/*|*" "*) die "DOMAIN should be just the name, e.g. maisonhorlogere.in (no https://, no slashes)";; esac

if [ "$CMD" = "deploy" ] || [ "$CMD" = "setup" ]; then
  for v in ADMIN_EMAILS LETSENCRYPT_EMAIL EMAIL_FROM; do [ -n "${!v:-}" ] || missing="$missing $v"; done
  if [ -z "${RESEND_API_KEY:-}" ] && { [ -z "${SMTP_HOST:-}" ] || [ -z "${SMTP_USER:-}" ] || [ -z "${SMTP_PASSWORD:-}" ]; }; then
    missing="$missing SMTP_USER/SMTP_PASSWORD(or RESEND_API_KEY)"
  fi
  [ -z "$missing" ] || die "Fill in .env.production:$missing"

  # Generate secrets on first deploy and save them back so every later deploy reuses them.
  if [ -z "${AUTH_SECRET:-}" ]; then
    set_env AUTH_SECRET "$(openssl rand -base64 32)"; ok "Generated AUTH_SECRET (saved in .env.production)"
  fi
  if [ -z "${DATABASE_URL:-}" ]; then
    set_env DATABASE_URL "postgresql://maison:$(openssl rand -hex 24)@127.0.0.1:5432/maison"
    ok "Generated a database password (saved in .env.production — keep that file safe)"
  fi
  load_env
fi

# Local DB on the VPS? Then setup creates it with these credentials.
LOCAL_DB=0; DB_NAME=""; DB_USER=""; DB_PASS=""
if [ -n "${DATABASE_URL:-}" ]; then
  eval "$(DATABASE_URL="$DATABASE_URL" node -e '
    const u = new URL(process.env.DATABASE_URL);
    const local = ["127.0.0.1", "localhost", "::1"].includes(u.hostname);
    const q = (v) => "\x27" + String(v).replace(/\x27/g, "\x27\\\x27\x27") + "\x27";
    console.log(`LOCAL_DB=${local ? 1 : 0} DB_NAME=${q(u.pathname.slice(1))} DB_USER=${q(decodeURIComponent(u.username))} DB_PASS=${q(decodeURIComponent(u.password))}`);
  ')"
fi

# ── SSH (one connection, reused; asks for the password at most once) ───────────
REMOTE="$DEPLOY_USER@$DEPLOY_HOST"
CONTROL="${TMPDIR:-/tmp}/maison-deploy-$$.sock"
SSH_OPTS=(-p "$DEPLOY_SSH_PORT" -o ControlMaster=auto -o "ControlPath=$CONTROL" -o ControlPersist=15m
          -o StrictHostKeyChecking=accept-new -o ServerAliveInterval=30 -o ConnectTimeout=15)
[ -n "${DEPLOY_SSH_KEY:-}" ] && SSH_OPTS+=(-i "${DEPLOY_SSH_KEY/#\~/$HOME}")
cleanup() { ssh "${SSH_OPTS[@]}" -O exit "$REMOTE" >/dev/null 2>&1 || true; }
trap cleanup EXIT

SUDO=""; [ "$DEPLOY_USER" = "root" ] || SUDO="sudo"
remote() { ssh "${SSH_OPTS[@]}" "$REMOTE" "$@"; }
# Run a root command (works for root, or a user with passwordless sudo).
remote_root() { remote "$SUDO bash -c $(printf '%q' "$1")"; }
# Run a command as the app user.
remote_app() { remote "sudo -u $APP_USER -H bash -c $(printf '%q' "$1")"; }  # root has sudo too
rsync_to() { rsync -az -e "ssh ${SSH_OPTS[*]}" "$@"; }

connect() {
  step "Connecting to $REMOTE"
  ssh "${SSH_OPTS[@]}" -fN "$REMOTE" || die "Couldn't SSH to $REMOTE (check DEPLOY_HOST / DEPLOY_USER / DEPLOY_SSH_KEY)."
  if [ -n "$SUDO" ]; then remote "sudo -n true" 2>/dev/null || die "$DEPLOY_USER needs passwordless sudo (or use DEPLOY_USER=root, Hostinger's default)."; fi
  SERVER_IP="$(remote "curl -fsS4 --max-time 5 https://api.ipify.org 2>/dev/null || hostname -I | awk '{print \$1}'")"
  ok "connected ($SERVER_IP)"
}

# ── commands ─────────────────────────────────────────────────────────────────
server_setup() {
  step "Setting up the server (first time takes ~5 minutes)"
  # Piped over SSH (a fresh server may not have rsync yet — setup installs it).
  remote "cat > /tmp/maison-server-setup.sh" < deploy/server-setup.sh
  remote "$SUDO env DOMAIN=$(printf '%q' "$DOMAIN") DOMAIN_WWW=$(printf '%q' "$DOMAIN_WWW") LETSENCRYPT_EMAIL=$(printf '%q' "${LETSENCRYPT_EMAIL:-}") \
    DEPLOY_PATH=$(printf '%q' "$DEPLOY_PATH") APP_PORT=$APP_PORT APP_USER=$APP_USER SERVER_IP=$SERVER_IP SSH_PORT=$DEPLOY_SSH_PORT \
    LOCAL_DB=$LOCAL_DB DB_NAME=$(printf '%q' "$DB_NAME") DB_USER=$(printf '%q' "$DB_USER") DB_PASS=$(printf '%q' "$DB_PASS") \
    bash /tmp/maison-server-setup.sh; rm -f /tmp/maison-server-setup.sh"
}

upload_env() {
  local tmp; tmp="$(mktemp)"
  node deploy/env.mjs remote "$ENV_FILE" > "$tmp"
  rsync_to "$tmp" "$REMOTE:/tmp/maison.env"
  rm -f "$tmp"
  remote_root "install -o $APP_USER -g $APP_USER -m 600 /tmp/maison.env $DEPLOY_PATH/shared/.env && rm -f /tmp/maison.env"
  ok "settings uploaded (readable only by the app)"
}

health() { remote "curl -fsS --max-time 5 http://127.0.0.1:$APP_PORT/api/health" 2>/dev/null; }

wait_healthy() {
  local _
  for _ in $(seq 1 45); do
    if health | grep -q '"ok":true'; then return 0; fi
    sleep 2
  done
  return 1
}

switch_to() { # atomically point `current` at a release and restart
  remote_root "ln -sfn $DEPLOY_PATH/releases/$1 $DEPLOY_PATH/current.tmp && mv -Tf $DEPLOY_PATH/current.tmp $DEPLOY_PATH/current && systemctl restart maison"
}

local_checks() {
  [ "$SKIP_CHECKS" = "1" ] && { warn "local checks skipped"; return; }
  step "Checking the code on this computer (typecheck, lint, unit tests)"
  npx tsc --noEmit || die "TypeScript errors — fix them or use --skip-checks."
  npx eslint --quiet . || die "Lint errors — fix them or use --skip-checks."
  npx vitest run tests/unit --reporter=dot >/dev/null || die "Unit tests failed — run 'npx vitest run tests/unit' to see why."
  ok "all good"
  if [ -d .git ] && [ -n "$(git status --porcelain 2>/dev/null)" ]; then warn "you have uncommitted changes — they will be deployed as they are on disk"; fi
}

deploy() {
  local_checks
  connect

  local setup_version
  setup_version="$(remote "cat $DEPLOY_PATH/.setup-version 2>/dev/null || true")"
  if [ "$setup_version" != "3" ]; then server_setup; else ok "server already set up (run './deploy.sh setup' to redo it)"; fi

  step "Uploading settings"
  upload_env

  local release prev
  release="$(date +%Y%m%d-%H%M%S)"
  prev="$(remote "readlink $DEPLOY_PATH/current 2>/dev/null | xargs -r basename" || true)"

  step "Uploading code → release $release"
  remote_root "install -d -o $APP_USER -g $APP_USER $DEPLOY_PATH/releases/$release"
  rsync_to --delete \
    --exclude='.git/' --exclude='node_modules/' --exclude='.next/' --exclude='.next-*/' --exclude='src/generated/' \
    --exclude='.env' --exclude='.env.*' --exclude='.pgdata/' --exclude='.dev-mail/' --exclude='.media/' \
    --exclude='public/uploads/' --exclude='backups/' --exclude='tests/' --exclude='test-results/' \
    --exclude='playwright-report/' --exclude='.lighthouseci/' --exclude='*.tsbuildinfo' --exclude='.DS_Store' \
    --exclude='.claude/' --exclude='deploy.sh' \
    ./ "$REMOTE:/tmp/maison-release-$release/"
  remote_root "rsync -a --delete /tmp/maison-release-$release/ $DEPLOY_PATH/releases/$release/ && rm -rf /tmp/maison-release-$release && chown -R $APP_USER:$APP_USER $DEPLOY_PATH/releases/$release"
  ok "code uploaded"

  step "Building release $release on the server (the live site keeps running meanwhile)"
  remote_app "bash $DEPLOY_PATH/releases/$release/deploy/release.sh $DEPLOY_PATH/releases/$release $DEPLOY_PATH/shared" \
    || { remote_root "rm -rf $DEPLOY_PATH/releases/$release"; die "Build failed — the live site was NOT changed."; }

  step "Going live"
  switch_to "$release"
  if wait_healthy; then
    ok "release $release is live and healthy"
  else
    warn "new release didn't pass the health check — showing logs:"
    remote_root "journalctl -u maison -n 40 --no-pager" || true
    if [ -n "$prev" ]; then
      switch_to "$prev"
      die "Rolled back to $prev. The live site is running the previous version."
    fi
    die "First release failed to start. Check: ./deploy.sh logs"
  fi

  step "Cleaning up old releases (keeping $KEEP_RELEASES)"
  remote_root "cd $DEPLOY_PATH/releases && ls -1d */ | sed 's#/##' | sort | head -n -$KEEP_RELEASES | xargs -r rm -rf"
  ok "done"

  step "Checking the public site"
  local scheme=https
  if remote "test -f $DEPLOY_PATH/.ssl-pending"; then scheme=http; fi
  local code
  code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 "$scheme://$DOMAIN/api/health" || true)"
  if [ "$code" = "200" ]; then ok "$scheme://$DOMAIN is up"; else warn "$scheme://$DOMAIN answered $code from this computer (DNS may still be propagating)"; fi

  printf '\n'; bold "✓ Deployed $release → $scheme://$DOMAIN"
  [ "$scheme" = "http" ] && warn "HTTPS is pending: point $DOMAIN's A record at $SERVER_IP, then run ./deploy.sh setup"
  if ! remote "test -f $DEPLOY_PATH/shared/.welcomed"; then
    printf '\n'; bold "First deploy — next steps:"
    echo "  1. Sign in at $scheme://$DOMAIN/sign-in with an address from ADMIN_EMAILS (you become admin)."
    echo "  2. Admin → Settings: store name, address, GSTIN, and your UPI ID (payments stay off until it's set)."
    echo "  3. Add products: Admin → Import (your CSV), or ./deploy.sh copy-catalog to copy your local catalogue."
    remote_root "touch $DEPLOY_PATH/shared/.welcomed"
  fi
}

# Sets $url on the server from shared/.env without sourcing it (passwords may contain $ or quotes).
DB_URL_CMD="url=\$(sed -n 's/^DATABASE_URL=\"\\(.*\\)\"\$/\\1/p' $DEPLOY_PATH/shared/.env | head -n1)"

copy_catalog() {
  connect
  # pg_dump must be at least as new as the database (17); an older one in PATH would refuse.
  local PG_DUMP=""
  for c in /opt/homebrew/opt/postgresql@18/bin/pg_dump /opt/homebrew/opt/postgresql@17/bin/pg_dump /usr/local/opt/postgresql@17/bin/pg_dump \
           /usr/lib/postgresql/18/bin/pg_dump /usr/lib/postgresql/17/bin/pg_dump "$(command -v pg_dump || true)"; do
    if [ -x "$c" ] && [ "$("$c" --version | sed -E 's/.* ([0-9]+)\..*/\1/')" -ge 17 ]; then PG_DUMP="$c"; break; fi
  done
  [ -n "$PG_DUMP" ] || die "pg_dump 17+ not found on this computer (run ./scripts/setup-local.sh)."
  local LOCAL_URL; LOCAL_URL="$(node -e 'process.stdout.write(require("dotenv").parse(require("fs").readFileSync(".env")).DATABASE_URL || "")')"  # parse the file itself: the environment already holds the production URL
  [ -n "$LOCAL_URL" ] || die "No DATABASE_URL in your local .env."

  step "Checking the live store is empty"
  local counts
  counts="$(remote_app "$DB_URL_CMD && psql \"\$url\" -tA -c 'select (select count(*) from \"Product\") || chr(32) || (select count(*) from \"Order\")'")"
  [ "$counts" = "0 0" ] || die "The live store already has products/orders ($counts). copy-catalog only runs on an empty store, so nothing was changed."
  ok "live store is empty"

  step "Exporting your local catalogue"
  local dump; dump="$(mktemp)"
  "$PG_DUMP" --data-only --no-owner --no-privileges \
    -t '"Brand"' -t '"Collection"' -t '"Product"' -t '"ProductImage"' -t '"ProductCollection"' -t '"HomeBanner"' "$LOCAL_URL" \
    | perl -ne 'next if /^SET transaction_timeout/; s#\t/uploads/#\t/media/#g; print' > "$dump"
  local want; want="$("$(dirname "$PG_DUMP")/psql" "$LOCAL_URL" -tAc 'select count(*) from "Product"')"
  [ "${want:-0}" -gt 0 ] && grep -q '^COPY public."Product"' "$dump" || die "Your local database has no products to copy (or the export failed)."
  ok "$want products exported"

  step "Uploading images you uploaded locally (product photos from links stay as links)"
  for d in .media public/uploads; do [ -d "$d" ] && rsync_to "$d/" "$REMOTE:/tmp/maison-media/"; done
  remote_root "[ -d /tmp/maison-media ] && rsync -a /tmp/maison-media/ $DEPLOY_PATH/shared/media/ && chown -R $APP_USER:$APP_USER $DEPLOY_PATH/shared/media && rm -rf /tmp/maison-media || true"

  step "Importing into the live database"
  rsync_to "$dump" "$REMOTE:/tmp/maison-catalog.sql"; rm -f "$dump"
  remote_root "chown $APP_USER /tmp/maison-catalog.sql"
  remote_app "$DB_URL_CMD && cd $DEPLOY_PATH/current && \
    { echo 'TRUNCATE \"HomeBanner\", \"ProductCollection\", \"ProductImage\", \"Product\", \"Collection\", \"Brand\" CASCADE;'; cat /tmp/maison-catalog.sql; } \
    | psql \"\$url\" -q -v ON_ERROR_STOP=1 --single-transaction >/dev/null && rm -f /tmp/maison-catalog.sql && rm -rf .next/cache/fetch-cache"
  local got; got="$(remote_app "$DB_URL_CMD && psql \"\$url\" -tAc 'select count(*) from \"Product\"'")"
  [ "$got" = "$want" ] || die "Import mismatch: $want products locally, $got on the server."
  remote_root "systemctl restart maison"
  wait_healthy || die "Imported, but the app didn't come back healthy. Check: ./deploy.sh logs"
  # Pages pre-rendered at build time still show the old (empty) store — ask the app to rebuild them.
  remote_root "secret=\$(sed -n 's/^AUTH_SECRET=\"\\(.*\\)\"\$/\\1/p' $DEPLOY_PATH/shared/.env | head -n1) && \
    curl -fsS -X POST -H \"x-revalidate-token: \$secret\" http://127.0.0.1:$APP_PORT/api/internal/revalidate >/dev/null && \
    for p in / /watches /collections; do curl -fsS -o /dev/null http://127.0.0.1:$APP_PORT\$p; done"
  ok "catalogue copied — $got products are live"
}

rollback() {
  connect
  local cur prev
  cur="$(remote "readlink $DEPLOY_PATH/current | xargs basename")"
  prev="$(remote "ls -1 $DEPLOY_PATH/releases | sort | grep -B1 -x '$cur' | head -n1")"
  [ -n "$prev" ] && [ "$prev" != "$cur" ] || die "No earlier release to roll back to."
  step "Rolling back $cur → $prev"
  warn "database changes are not undone (migrations only ever add, so the older code still works)"
  switch_to "$prev"
  wait_healthy && ok "live on $prev" || die "Previous release isn't healthy either — check ./deploy.sh logs"
}

status() {
  connect
  remote_root "systemctl --no-pager status maison | head -n 12; echo; echo \"release: \$(readlink $DEPLOY_PATH/current | xargs basename)\"; df -h / | tail -n1 | awk '{print \"disk: \"\$3\" used of \"\$2}'; free -h | awk '/Mem:/{print \"memory: \"\$3\" used of \"\$2}'"
  printf '\nhealth: '; health || echo "not responding"; echo
}

backup() {
  connect
  step "Backing up the live database"
  local file; file="$(remote_app "/usr/local/bin/maison-backup")"
  mkdir -p backups
  # Streamed through sudo: backups are readable only by the app user.
  remote_root "cat $file" > "backups/$(basename "$file")"
  ok "saved backups/$(basename "$file")   (restore: pg_restore --clean --no-owner -d <db-url> <file>)"
}

case "$CMD" in
  deploy) deploy ;;
  setup) connect; server_setup ;;
  copy-catalog) copy_catalog ;;
  rollback) rollback ;;
  status) status ;;
  logs) connect; trap - ERR; remote_root "journalctl -u maison -f -n 100" || true ;;
  backup) backup ;;
  ssh) trap - ERR; ssh "${SSH_OPTS[@]}" -t "$REMOTE" "cd $DEPLOY_PATH 2>/dev/null; exec \$SHELL -l" || true ;;
esac
