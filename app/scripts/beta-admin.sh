#!/usr/bin/env bash
#
# Operator helper for the hosted beta. Wraps the curl calls so you never have
# to paste a token. Run it from app/ (where .env lives).
#
#   bash scripts/beta-admin.sh code            mint a new invite code
#   bash scripts/beta-admin.sh codes           list every code and its state
#   bash scripts/beta-admin.sh redeem <code>   redeem a code, save the session cookie
#   bash scripts/beta-admin.sh cards           list cards using the saved cookie
#   bash scripts/beta-admin.sh leads           the steward queue (pending Data Leads)
#   bash scripts/beta-admin.sh report <id>     read one Contextual Report
#   bash scripts/beta-admin.sh revoke <code>   revoke a code
#   bash scripts/beta-admin.sh stop <code>     stop request: revoke + delete usage records
#   bash scripts/beta-admin.sh health          health probe
#
# The token comes from .env. Nothing secret is echoed.

set -euo pipefail

if [[ ! -f .env ]]; then
  echo "Run this from app/ (where .env lives): cd app && bash scripts/beta-admin.sh $*" >&2
  exit 1
fi
set -a; . ./.env; set +a

: "${HOST:?HOST is not set in .env}"
: "${ADMIN_TOKEN:?ADMIN_TOKEN is not set in .env}"

COOKIE_JAR="${TMPDIR:-/tmp}/beta-session.txt"
AUTH=(-H "Authorization: Bearer $ADMIN_TOKEN")

die() { echo "$*" >&2; exit 1; }

cmd="${1:-}"; shift || true

case "$cmd" in
  code)
    curl -sS -X POST "${AUTH[@]}" "$HOST/api/admin/invites" | jq -r '.code.code'
    ;;

  codes)
    curl -sS "${AUTH[@]}" "$HOST/api/admin/invites" \
      | jq -r '.codes[] | "\(.code)  \(if .revokedAt then "revoked" else "active" end)"'
    ;;

  redeem)
    [[ $# -ge 1 ]] || die "usage: beta-admin.sh redeem <code>"
    curl -sS -c "$COOKIE_JAR" -X POST -H 'Content-Type: application/json' \
      -d "$(jq -nc --arg c "$1" '{code:$c}')" "$HOST/api/invite/redeem"
    echo
    echo "session saved to $COOKIE_JAR"
    ;;

  cards)
    # Report the HTTP status too: a revoked or missing session returns 401 with
    # {"error":"Unauthorized"}, and a bare "0" from jq would look like an empty catalog.
    body=$(curl -sS -b "$COOKIE_JAR" -w '\n%{http_code}' "$HOST/api/cards")
    status=$(printf '%s' "$body" | tail -n1)
    json=$(printf '%s' "$body" | sed '$d')
    if [[ "$status" == "200" ]]; then
      printf '%s' "$json" | jq '.cards | length'
    else
      echo "HTTP $status — $(printf '%s' "$json" | jq -r '.error // "no session"')"
      echo "Redeem a code first: bash scripts/beta-admin.sh redeem <code>"
    fi
    ;;

  leads)
    curl -sS "${AUTH[@]}" "$HOST/api/admin/leads" | jq '.leads | length'
    ;;

  report)
    [[ $# -ge 1 ]] || die "usage: beta-admin.sh report <report id>"
    curl -sS "${AUTH[@]}" "$HOST/api/admin/reports/$1" | jq '.report'
    ;;

  revoke)
    [[ $# -ge 1 ]] || die "usage: beta-admin.sh revoke <code>"
    curl -sS -X POST "${AUTH[@]}" "$HOST/api/admin/invites/$1/revoke"
    echo
    ;;

  stop)
    [[ $# -ge 1 ]] || die "usage: beta-admin.sh stop <code>"
    echo "Revoking $1 and deleting its usage records..."
    npm run stop-request -- "$1"
    ;;

  health)
    curl -sS "$HOST/api/health" | jq
    ;;

  *)
    sed -n '/^#   bash scripts/,/^#$/p' "$0" | sed 's/^# \{0,1\}//'
    exit 1
    ;;
esac
