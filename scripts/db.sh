#!/bin/bash
# Local PostgreSQL for this project (data in ./.pgdata).  Usage: npm run db:start | db:stop | db:status
set -euo pipefail
cd "$(dirname "$0")/.."
# shellcheck source=scripts/lib-platform.sh
. scripts/lib-platform.sh
PG_PORT="${PG_PORT:-5433}"
find_pgbin || { echo "PostgreSQL 17 not found — run ./scripts/setup-local.sh first."; exit 1; }
export LC_ALL="$PG_LOCALE"
case "${1:-status}" in
  start) "$PGBIN/pg_isready" -q -h /tmp -p "$PG_PORT" && echo "already running" || "$PGBIN/pg_ctl" -D .pgdata -l .pgdata/server.log -o "-p $PG_PORT -k /tmp" -w start ;;
  stop) "$PGBIN/pg_ctl" -D .pgdata stop ;;
  *) "$PGBIN/pg_isready" -h /tmp -p "$PG_PORT" ;;
esac
