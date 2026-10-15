#!/usr/bin/env bash
#
# Daily backup of the hosted Neon database. Run from app/ (where .env lives)
# via cron or launchd. Uses pg_dump 18 (Homebrew) — must match the PG 18 server.
#
#   0 21 * * * cd /path/to/repo/app && bash scripts/backup-neon.sh
#
# Prunes files older than 30 days. Destination: the directory this creates,
# or BACKUP_DIR if set. Outside any git repo by default.
#
# Secret handling: DATABASE_URL (which embeds the Neon password) is kept in the
# process environment only — pg_dump reads it from env, never from argv, so the
# connection string does not appear in `ps`. Do not pass "$DATABASE_URL" as a
# positional argument to pg_dump; that exposes it to other users on the host.

set -euo pipefail

PG18=/opt/homebrew/opt/postgresql@18/bin
BACKUP_DIR="${BACKUP_DIR:-$HOME/beta-backups}"
DATE=$(date +%F)
DUMP_FILE="$BACKUP_DIR/ccplatform-$DATE.sql"

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"

# Load DATABASE_URL from .env, then split it into PG* env vars so the
# connection string (and its embedded password) never appears in `ps` argv.
if [[ ! -f ./.env ]]; then
  echo "Error: .env not found. Run this script from app/ (where .env lives)." >&2
  exit 1
fi
set -a; . ./.env; set +a

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL is not set in .env" >&2
  exit 1
fi

# postgresql://user:pass@host:port/dbname?sslmode=require&channel_binding=require
u="${DATABASE_URL#*://}"
userinfo="${u%%@*}"; rest="${u#*@}"
sslmode=""; if [[ "$rest" == *"?"* ]]; then
  query="${rest#*\?}"; rest="${rest%%\?*}"
  for p in ${query//&/ }; do [[ "$p" == sslmode=* ]] && sslmode="${p#sslmode=}"; done
fi
dbname=""; if [[ "$rest" == *"/"* ]]; then dbname="${rest#*/}"; rest="${rest%%/*}"; fi
host="$rest"; port="5432"
[[ "$host" == *":"* ]] && { port="${host#*:}"; host="${host%%:*}"; }
export PGHOST="$host" PGPORT="$port" PGUSER="${userinfo%%:*}" PGPASSWORD="${userinfo#*:}"
[[ -n "$dbname" ]] && export PGDATABASE="$dbname"
[[ -n "$sslmode" ]] && export PGSSLMODE="$sslmode"
# ponytail: percent-encoded chars in the password are not decoded here; Neon
# passwords are plain alphanumeric, so this is fine. Revisit if a password
# ever needs URL-encoding.

echo "Dumping to $DUMP_FILE..."
"$PG18/pg_dump" --no-owner --no-acl -f "$DUMP_FILE"
ls -lh "$DUMP_FILE"

# Prune files older than 30 days
find "$BACKUP_DIR" -name 'ccplatform-*.sql' -mtime +30 -delete
echo "Pruned files older than 30 days in $BACKUP_DIR."
echo "Done."
