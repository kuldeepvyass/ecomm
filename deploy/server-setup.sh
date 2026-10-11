#!/usr/bin/env bash
# One-time (idempotent) server setup for Maison Horlogère on an Ubuntu/Debian VPS (Hostinger).
# Run by ./deploy.sh as root — not meant to be run by hand. Safe to re-run: every step checks first.
#
# Installs: Node.js 24 LTS (same major as development), PostgreSQL 17 (when the DB is local), Nginx, Let's Encrypt (certbot),
# ufw firewall, fail2ban, unattended security upgrades, swap, nightly DB backups, systemd service.
set -Eeuo pipefail

: "${DOMAIN:?}" "${DEPLOY_PATH:?}" "${APP_PORT:?}" "${APP_USER:?}" "${SERVER_IP:?}" "${SSH_PORT:?}"
DOMAIN_WWW="${DOMAIN_WWW:-true}"
LOCAL_DB="${LOCAL_DB:-0}"
SETUP_VERSION=3
export DEBIAN_FRONTEND=noninteractive

step() { printf '\n\033[1;33m▸ %s\033[0m\n' "$*"; }
ok() { printf '  \033[32m✓\033[0m %s\n' "$*"; }
warn() { printf '  \033[33m!\033[0m %s\n' "$*"; }

[ "$(id -u)" -eq 0 ] || { echo "server-setup.sh must run as root"; exit 1; }
command -v apt-get >/dev/null || { echo "This script supports Ubuntu/Debian (apt) servers."; exit 1; }
. /etc/os-release
CODENAME="${VERSION_CODENAME:-$(lsb_release -cs 2>/dev/null || true)}"

step "Swap (keeps the build from running out of memory on small plans)"
if swapon --show | grep -q .; then
  ok "swap already on"
else
  fallocate -l 2G /swapfile || dd if=/dev/zero of=/swapfile bs=1M count=2048
  chmod 600 /swapfile && mkswap /swapfile >/dev/null && swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
  ok "2 GB swap added"
fi

step "System packages"
apt-get update -qq
apt-get install -y -qq sudo curl ca-certificates gnupg lsb-release rsync git build-essential nginx certbot ufw fail2ban unattended-upgrades cron >/dev/null
ok "nginx, certbot, ufw, fail2ban, unattended-upgrades"

step "Automatic security updates"
cat > /etc/apt/apt.conf.d/20auto-upgrades <<'EOF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
EOF
systemctl enable --now unattended-upgrades >/dev/null 2>&1 || true
systemctl enable --now fail2ban >/dev/null 2>&1 || true
ok "enabled (security patches install nightly; fail2ban blocks SSH brute force)"

step "Node.js 24 LTS"
NODE_MAJOR="$(node -v 2>/dev/null | sed -E 's/^v([0-9]+).*/\1/' || echo 0)"
if [ "${NODE_MAJOR:-0}" -ge 24 ] 2>/dev/null; then
  ok "node $(node -v) already installed"
else
  curl -fsSL https://deb.nodesource.com/setup_24.x | bash - >/dev/null
  apt-get install -y -qq nodejs >/dev/null
  ok "node $(node -v)"
fi

step "PostgreSQL client tools (17, from the official PostgreSQL apt repo)"
if [ ! -f /etc/apt/sources.list.d/pgdg.list ]; then
  install -d /usr/share/postgresql-common/pgdg
  curl -fsSL -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc https://www.postgresql.org/media/keys/ACCC4CF8.asc
  echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] https://apt.postgresql.org/pub/repos/apt ${CODENAME}-pgdg main" > /etc/apt/sources.list.d/pgdg.list
  apt-get update -qq
fi
apt-get install -y -qq postgresql-client-17 >/dev/null
ok "pg_dump/psql 17"

if [ "$LOCAL_DB" = "1" ]; then
  : "${DB_NAME:?}" "${DB_USER:?}" "${DB_PASS:?}"
  step "PostgreSQL 17 server (local database)"
  apt-get install -y -qq postgresql-17 >/dev/null
  systemctl enable --now postgresql >/dev/null
  # Role + database (password re-applied each run so it always matches .env.production).
  sudo -u postgres psql -q -v ON_ERROR_STOP=1 -v u="$DB_USER" -v pw="$DB_PASS" -v db="$DB_NAME" <<'SQL'
SELECT format('CREATE ROLE %I LOGIN', :'u') WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = :'u') \gexec
SELECT format('ALTER ROLE %I WITH LOGIN PASSWORD %L', :'u', :'pw') \gexec
SELECT format('CREATE DATABASE %I OWNER %I ENCODING ''UTF8'' TEMPLATE template0', :'db', :'u') WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = :'db') \gexec
SELECT format('ALTER DATABASE %I OWNER TO %I', :'db', :'u') \gexec
SQL
  ok "database '$DB_NAME' (listens on localhost only)"
fi

step "App user and folders"
id "$APP_USER" >/dev/null 2>&1 || useradd --system --create-home --home-dir "/home/$APP_USER" --shell /usr/sbin/nologin "$APP_USER"
install -d -o "$APP_USER" -g "$APP_USER" -m 755 "$DEPLOY_PATH" "$DEPLOY_PATH/releases" "$DEPLOY_PATH/shared" "$DEPLOY_PATH/shared/media"
install -d -o "$APP_USER" -g "$APP_USER" -m 700 "$DEPLOY_PATH/shared/backups"
install -d -m 755 /var/www/letsencrypt
ok "$DEPLOY_PATH (releases/, shared/media, shared/backups) owned by '$APP_USER'"

step "systemd service 'maison'"
cat > /etc/systemd/system/maison.service <<EOF
[Unit]
Description=Maison Horlogère storefront (Next.js)
After=network-online.target postgresql.service
Wants=network-online.target

[Service]
Type=simple
User=$APP_USER
Group=$APP_USER
WorkingDirectory=$DEPLOY_PATH/current
EnvironmentFile=$DEPLOY_PATH/shared/.env
Environment=NODE_ENV=production
ExecStart=/usr/bin/node node_modules/next/dist/bin/next start -H 127.0.0.1 -p $APP_PORT
Restart=always
RestartSec=3
TimeoutStopSec=20
LimitNOFILE=65536
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=full
ProtectHome=true

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable maison >/dev/null 2>&1
ok "starts on boot, restarts on crash; logs: journalctl -u maison"

step "Nightly database backups (02:30, kept 14 days)"
cat > /usr/local/bin/maison-backup <<EOF
#!/usr/bin/env bash
# Dumps the store database to $DEPLOY_PATH/shared/backups (custom format: restore with pg_restore).
set -euo pipefail
cd /   # cron/sudo may start us in a directory this user can't read
# Read just the DB URL (never source the file: passwords may contain \$ or quotes).
val() { sed -n "s/^\$1=\"\\(.*\\)\"\$/\\1/p" "$DEPLOY_PATH/shared/.env" | head -n1; }
url="\$(val DIRECT_URL)"; [ -n "\$url" ] || url="\$(val DATABASE_URL)"
out="$DEPLOY_PATH/shared/backups/db-\$(date +%Y%m%d-%H%M%S).dump"
pg_dump --format=custom --no-owner --dbname="\$url" --file="\$out"
find "$DEPLOY_PATH/shared/backups" -name 'db-*.dump' -mtime +14 -delete
echo "\$out"
EOF
chmod 755 /usr/local/bin/maison-backup
echo "30 2 * * * $APP_USER /usr/local/bin/maison-backup >/dev/null 2>&1" > /etc/cron.d/maison-backup
ok "/usr/local/bin/maison-backup"

step "Firewall (SSH, HTTP, HTTPS only)"
# Allow the port we connected on AND every port sshd really listens on, so enabling the
# firewall can never lock you out.
for p in "$SSH_PORT" $(ss -tlnpH 2>/dev/null | awk '/sshd/ {n=split($4,a,":"); print a[n]}' | sort -u); do
  ufw allow "$p/tcp" >/dev/null
done
ufw allow 'Nginx Full' >/dev/null
ufw --force enable >/dev/null
ok "ufw active — the app port $APP_PORT is NOT reachable from outside"

# ── Nginx + HTTPS ────────────────────────────────────────────────────────────
resolves_here() { [ "$(getent ahostsv4 "$1" 2>/dev/null | awk 'NR==1{print $1}')" = "$SERVER_IP" ]; }
NAMES="$DOMAIN"
if [ "$DOMAIN_WWW" = "true" ]; then
  if resolves_here "www.$DOMAIN"; then NAMES="$DOMAIN www.$DOMAIN"; else warn "www.$DOMAIN doesn't point to $SERVER_IP yet — serving $DOMAIN only (re-run ./deploy.sh setup after adding the DNS record)"; fi
fi
CERT="/etc/letsencrypt/live/$DOMAIN/fullchain.pem"

write_proxy_locations() {
  cat <<EOF
    client_max_body_size 25m;

    # Uploaded images live outside the release folder; served straight from disk.
    location /media/ {
        alias $DEPLOY_PATH/shared/media/;
        access_log off;
        expires 1y;
        add_header Cache-Control "public, max-age=31536000, immutable";
        add_header X-Content-Type-Options nosniff;
    }

    location / {
        proxy_pass http://maison_app;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        proxy_set_header Host \$host;
        # Overwrite (not append) so clients can't spoof their IP for rate limits.
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$remote_addr;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header X-Forwarded-Host \$host;
        proxy_read_timeout 300s;   # bulk import commits can take a while
        proxy_send_timeout 300s;
    }
EOF
}

write_nginx() {
  local site=/etc/nginx/sites-available/maison
  {
    echo "upstream maison_app { server 127.0.0.1:$APP_PORT; keepalive 32; }"
    echo
    if [ -f "$CERT" ]; then
      cat <<EOF
server {
    listen 80;
    listen [::]:80;
    server_name $NAMES;
    location /.well-known/acme-challenge/ { root /var/www/letsencrypt; }
    location / { return 301 https://$DOMAIN\$request_uri; }
}
EOF
      if [ "$NAMES" != "$DOMAIN" ]; then
        cat <<EOF

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name www.$DOMAIN;
    ssl_certificate $CERT;
    ssl_certificate_key /etc/letsencrypt/live/$DOMAIN/privkey.pem;
    return 301 https://$DOMAIN\$request_uri;
}
EOF
      fi
      cat <<EOF

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name $DOMAIN;

    ssl_certificate $CERT;
    ssl_certificate_key /etc/letsencrypt/live/$DOMAIN/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:MaisonSSL:10m;
    ssl_session_timeout 1d;

    gzip on;
    gzip_proxied any;
    gzip_min_length 1024;
    gzip_types text/plain text/css application/javascript application/json image/svg+xml application/xml;

$(write_proxy_locations)
}
EOF
    else
      cat <<EOF
server {
    listen 80;
    listen [::]:80;
    server_name $NAMES;
    location /.well-known/acme-challenge/ { root /var/www/letsencrypt; }

$(write_proxy_locations)
}
EOF
    fi
  } > "$site"
  ln -sfn "$site" /etc/nginx/sites-enabled/maison
  rm -f /etc/nginx/sites-enabled/default
  nginx -t -q && systemctl reload nginx
}

step "Nginx for $NAMES"
systemctl enable --now nginx >/dev/null
write_nginx
ok "reverse proxy → 127.0.0.1:$APP_PORT"

step "HTTPS certificate (Let's Encrypt)"
cert_covers_all() {
  [ -f "$CERT" ] && openssl x509 -checkend 2592000 -noout -in "$CERT" >/dev/null 2>&1 || return 1
  local sans; sans="$(openssl x509 -noout -text -in "$CERT")"
  for n in $NAMES; do printf '%s' "$sans" | grep -q "DNS:$n\b" || return 1; done
}
if cert_covers_all; then
  ok "certificate already valid for $NAMES"
elif resolves_here "$DOMAIN"; then
  : "${LETSENCRYPT_EMAIL:?LETSENCRYPT_EMAIL is required for HTTPS}"
  args=(); for n in $NAMES; do args+=(-d "$n"); done
  certbot certonly --webroot -w /var/www/letsencrypt "${args[@]}" --cert-name "$DOMAIN" --expand \
    --email "$LETSENCRYPT_EMAIL" --agree-tos --no-eff-email --non-interactive \
    --deploy-hook "systemctl reload nginx" >/dev/null
  write_nginx
  ok "HTTPS on for $NAMES (auto-renews)"
else
  warn "$DOMAIN doesn't point to $SERVER_IP yet ($(getent ahostsv4 "$DOMAIN" | awk 'NR==1{print $1}' || echo 'no DNS record')) — site runs on plain HTTP for now."
  warn "Add the DNS A record, wait for it to propagate, then run: ./deploy.sh setup"
  echo "SSL_PENDING" > "$DEPLOY_PATH/.ssl-pending"
fi
[ -f "$CERT" ] && rm -f "$DEPLOY_PATH/.ssl-pending"

echo "$SETUP_VERSION" > "$DEPLOY_PATH/.setup-version"
printf '\n\033[32mServer setup complete.\033[0m\n'
