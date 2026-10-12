#!/bin/bash
# Local PostgreSQL for this project (data in ./.pgdata).  Usage: npm run db:start | db:stop | db:status
set -euo pipefail
cd "$(dirname "$0")/.."
PG_PORT="${PG_PORT:-5433}"
PGBIN="$(brew --prefix postgresql@17)/bin"
export LC_ALL=en_US.UTF-8
case "${1:-status}" in
  start) "$PGBIN/pg_isready" -q -h /tmp -p "$PG_PORT" && echo "already running" || "$PGBIN/pg_ctl" -D .pgdata -l .pgdata/server.log -o "-p $PG_PORT -k /tmp" -w start ;;
  stop) "$PGBIN/pg_ctl" -D .pgdata stop ;;
  *) "$PGBIN/pg_isready" -h /tmp -p "$PG_PORT" ;;
esac
