#!/bin/bash
# Shared by setup-local.sh and db.sh: finds (and with --install, installs) Node 24 and PostgreSQL 17 on
# macOS (Homebrew) or Ubuntu/Debian — including Windows via WSL2. Sets PGBIN and PG_LOCALE.
# shellcheck disable=SC2034  # variables are used by the scripts that source this file

OS="$(uname -s)"
IS_WSL=0; grep -qi microsoft /proc/version 2>/dev/null && IS_WSL=1

if [ "$OS" = "Darwin" ]; then
  PG_LOCALE="en_US.UTF-8"
else
  PG_LOCALE="C.UTF-8"   # always present on Ubuntu/WSL (en_US may not be generated)
fi

platform_check() {
  if [ "$IS_WSL" = "1" ] && case "$PWD" in /mnt/*) true ;; *) false ;; esac; then
    echo "This folder is on the Windows drive ($PWD). PostgreSQL can't run from there and it's very slow."
    echo "Clone the project inside WSL instead, e.g.:  cd ~ && git clone https://github.com/kuldeepvyass/ecomm.git luxury-watch-store"
    exit 1
  fi
  if [ "$OS" != "Darwin" ] && ! command -v apt-get >/dev/null; then
    echo "Supported: macOS, or Ubuntu/Debian (on Windows: WSL2 with Ubuntu)."; exit 1
  fi
}

node_major() { node -v 2>/dev/null | sed -E 's/^v([0-9]+).*/\1/' || echo 0; }

install_node() {
  if [ "$OS" = "Darwin" ]; then
    command -v brew >/dev/null || { echo "Homebrew is required on macOS: https://brew.sh"; exit 1; }
    brew install node@24 >/dev/null
    NODE_BIN="$(brew --prefix node@24)/bin"; export PATH="$NODE_BIN:$PATH"
    echo "  Installed Node 24. Add it to your shell: echo 'export PATH=\"$NODE_BIN:\$PATH\"' >> ~/.zshrc"
  else
    echo "  Installing Node 24 (asks for your Linux password)…"
    curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash - >/dev/null
    sudo apt-get install -y -qq nodejs >/dev/null
  fi
}

find_pgbin() {
  if [ "$OS" = "Darwin" ]; then
    PGBIN="$(brew --prefix postgresql@17 2>/dev/null)/bin"
  else
    PGBIN="/usr/lib/postgresql/17/bin"
  fi
  [ -x "$PGBIN/pg_ctl" ]
}

install_pg() {
  if [ "$OS" = "Darwin" ]; then
    brew install postgresql@17 >/dev/null
  else
    echo "  Installing PostgreSQL 17 from the official PostgreSQL apt repo (asks for your Linux password)…"
    sudo apt-get update -qq && sudo apt-get install -y -qq curl ca-certificates gnupg lsb-release >/dev/null
    sudo install -d /usr/share/postgresql-common/pgdg
    sudo curl -fsSL -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc https://www.postgresql.org/media/keys/ACCC4CF8.asc
    echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] https://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" \
      | sudo tee /etc/apt/sources.list.d/pgdg.list >/dev/null
    sudo apt-get update -qq && sudo apt-get install -y -qq postgresql-17 >/dev/null
    # The package also starts a system database on port 5432; this project uses its own on 5433, so stop it.
    sudo systemctl disable --now postgresql >/dev/null 2>&1 || sudo service postgresql stop >/dev/null 2>&1 || true
  fi
}

lan_ip() {
  if [ "$OS" = "Darwin" ]; then ipconfig getifaddr en0 2>/dev/null || true
  else hostname -I 2>/dev/null | awk '{print $1}'; fi
}
