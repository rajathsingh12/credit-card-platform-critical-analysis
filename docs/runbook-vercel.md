# Vercel Production Runbook

How to operate, test, and maintain the live invite-only MVP on Vercel.

**Production URL:** `https://credit-card-platform-critical-analy-zeta.vercel.app`

For **local development and testing**, see [runbook.md](runbook.md).

---

## 1. Quick start — testing the live app

All commands run from `app/`. The operator helper (`scripts/beta-admin.sh`) reads `HOST` and `ADMIN_TOKEN` from `.env` — no tokens are ever typed or pasted.

```bash
cd app

# Health check
bash scripts/beta-admin.sh health

# Mint a fresh invite code
bash scripts/beta-admin.sh code

# Open the invite page and paste the code
open https://credit-card-platform-critical-analy-zeta.vercel.app/invite

# After redeeming, you land on the calculator with 36 cards
```

### Full operator command reference

```bash
bash scripts/beta-admin.sh code            # mint a new invite code
bash scripts/beta-admin.sh codes           # every code and whether it is active or revoked
bash scripts/beta-admin.sh redeem <code>   # redeem, saving the session cookie
bash scripts/beta-admin.sh cards           # card count for that session (reports 401 clearly)
bash scripts/beta-admin.sh leads           # the steward queue (pending Data Leads)
bash scripts/beta-admin.sh report <id>     # read one Contextual Report
bash scripts/beta-admin.sh revoke <code>   # revoke a code
bash scripts/beta-admin.sh stop <code>     # stop request: revoke + delete usage records
bash scripts/beta-admin.sh health          # health probe
```

### End-to-end test flow

```bash
# 1. Mint a code
bash scripts/beta-admin.sh code
# → prints a 24-hex-character code

# 2. Redeem it (saves session cookie to /tmp/beta-session.txt)
bash scripts/beta-admin.sh redeem <code>

# 3. Verify the session works
bash scripts/beta-admin.sh cards
# → 36

# 4. Check the steward queue
bash scripts/beta-admin.sh leads

# 5. Revoke the code and confirm eviction
bash scripts/beta-admin.sh revoke <code>
bash scripts/beta-admin.sh cards
# → HTTP 401 — Unauthorized
```

---

## 2. Environment

### Vercel project

- **Root Directory:** `app/` (dashboard setting, not in `vercel.json`)
- **Framework:** Next.js (set in `app/vercel.json`)
- **Runtime:** Node.js (middleware declares `export const runtime = 'nodejs'`)

### Environment variables (Production + Preview)

| Variable | Shape | Notes |
|---|---|---|
| `DATABASE_URL` | Neon pooled string (contains `-pooler`) | Must be set for both build and runtime |
| `ADMIN_TOKEN` | 64-character hex | |
| `BETA_INVITE_CODES` | comma-separated 24-hex codes | Must match the seeded codes |

> **Trap:** `vercel link` writes `.vercel/` at the **repo root**, not `app/`. Run all Vercel CLI commands from the repo root. `vercel env add` from `app/` silently fails.

### Database (Neon)

- **Plan:** Free ($0/month, 1 GB storage)
- **Postgres version:** 18
- **Point-in-time restore window:** 6 hours (Free plan max)
- **Connection:** always use the **pooled** endpoint (`-pooler`). The direct endpoint is for `pg_dump` only.

---

## 3. Deploying

Vercel builds from `origin/main`. A push triggers a deploy.

```bash
# Manual deploy (from the repo root)
vercel --prod
```

> Changing environment variables does **not** trigger a redeploy. You must run `vercel --prod` or push a commit after changing env vars.

### Verify after deploy

```bash
bash scripts/beta-admin.sh health
# → { "status": "ok", "db": "connected" }
```

If health returns `db: disconnected`, `DATABASE_URL` is wrong, unpooled, or the database is unreachable.

---

## 4. Database setup (fresh environment)

From `app/`, with `DATABASE_URL` and `BETA_INVITE_CODES` exported:

```bash
export DATABASE_URL='<hosted pooled connection string>'
export BETA_INVITE_CODES='<comma-separated codes>'
npm run setup:db
npm run verify:seed
```

`setup:db` runs migrate → seed → seed --approve → seed:invites, all idempotent. `verify:seed` confirms zero Critical Calculation Errors over 360 probes.

Expect: 7 migrations, 40 cards, 36 published, 4 withheld, 62 redemption scenarios, invite codes upserted.

---

## 5. Backup and restore

### Taking a backup

The hosted DB is Neon PG 18. **Use `pg_dump` 18** — the Homebrew default (15) aborts on version mismatch.

```bash
PG18=/opt/homebrew/opt/postgresql@18/bin
set -a; . ./.env; set +a
"$PG18/pg_dump" "$DATABASE_URL" --no-owner --no-acl -f /tmp/ccplatform-$(date +%F).sql
ls -lh /tmp/ccplatform-*.sql      # expect ~88 KB
```

### Automated daily backup

`app/scripts/backup-neon.sh` dumps to `~/beta-backups/` with 30-day prune. Schedule with:

```bash
crontab -e
# add:
0 21 * * * cd /path/to/repo/app && bash scripts/backup-neon.sh
```

### Restore procedure

**Prerequisites:** a dump file, `postgresql@18` installed (`brew install postgresql@18`).

```bash
PG18=/opt/homebrew/opt/postgresql@18/bin

# 1. Take a fresh dump if needed
set -a; . ./.env; set +a
"$PG18/pg_dump" "$DATABASE_URL" --no-owner --no-acl -f /tmp/ccplatform-restore.sql

# 2. Start a throwaway PG 18 server — never restore into production
rm -rf /tmp/restore-pg18-data && mkdir -p /tmp/restore-pg18-data
"$PG18/initdb" -D /tmp/restore-pg18-data -U postgres --auth=trust --no-locale -E UTF8
"$PG18/pg_ctl" -D /tmp/restore-pg18-data -o "-p 5433" -l /tmp/restore-pg18.log start
"$PG18/pg_isready" -p 5433 -U postgres
"$PG18/psql" -p 5433 -U postgres -c 'CREATE DATABASE restore_probe'

# 3. Restore the dump
time "$PG18/psql" -p 5433 -U postgres -d restore_probe -v ON_ERROR_STOP=1 < /tmp/ccplatform-restore.sql

# 4. Verify counts match production
"$PG18/psql" -p 5433 -U postgres -d restore_probe -tA -c "
  SELECT 'cards', count(*) FROM cards
  UNION ALL SELECT 'rule_versions_active', count(*) FROM rule_versions WHERE retracted_at IS NULL
  UNION ALL SELECT 'invite_codes', count(*) FROM invite_codes
  UNION ALL SELECT 'verification_records', count(*) FROM verification_records
  UNION ALL SELECT 'beta_events', count(*) FROM beta_events
  UNION ALL SELECT 'contextual_reports', count(*) FROM contextual_reports
  UNION ALL SELECT 'redemption_scenarios', count(*) FROM redemption_scenarios"
# expect: cards|40  rule_versions_active|36  invite_codes|8  verification_records|40

# 5. Tear down the probe
"$PG18/pg_ctl" -D /tmp/restore-pg18-data stop -m fast
rm -rf /tmp/restore-pg18-data /tmp/restore-pg18.log
```

**For a real restore** (data loss on the host): create a fresh Neon database, restore the dump into it, set the new `DATABASE_URL` on the Vercel project (Production + Preview), and redeploy with `vercel --prod`. Confirm health and the invite gate before declaring service back.

### PG 18 trap

A PG 18 dump emits `SET transaction_timeout` (PG 17+ parameter) which PG 16 rejects on restore. Always restore into a PG 18 target. Docker `postgres:18` works too, but Colima's registry TLS is broken on this machine — Homebrew PG 18 is the path.

---

## 6. Uptime monitoring

**UptimeRobot** monitors `/api/health` every 5 minutes and alerts on failure.

- Monitor name: `CC-Platform-Health`
- URL: `https://credit-card-platform-critical-analy-zeta.vercel.app/api/health`
- Interval: 5 minutes
- Created: 2026-10-15

To verify the alert works: temporarily change the URL to `.../api/nope`, wait for the **Down** email, change it back, wait for the **Up** email.

---

## 7. Honouring the deletion promises

The notice on `/invite` makes two promises. Both commands run from `app/` with `DATABASE_URL` set.

### Stop request (one invitee, within 7 days)

```bash
npm run stop-request -- <invite code>
```

Revokes the code and deletes that invitee's `beta_events`. Reports survive unattributed. Then strike the code → name entry in the steward's off-git list.

### Beta close (within 30 days of the verdict)

```bash
npm run stop-request -- --purge-all
```

Deletes every `beta_events` row and every `invite_codes` row. Reports and the card catalog are untouched. Delete the code-to-name list by hand.

Both are idempotent.

---

## 8. Standing constraints

- **Middleware runs on Node, not Edge.** `export const runtime = 'nodejs'` in `middleware.ts`. Removing it silently breaks the invite gate at runtime while building green. Verify: `/_middleware` must read `"runtime": "nodejs"` in `functions-config-manifest.json`.
- **Pool cap must stay above 1.** `POST /api/reports` calls `pool.query` inside a `withTransaction`. At `max: 1`, the inner query deadlocks.
- **`next build` must succeed with `DATABASE_URL` unset.** The build guard skips the throw during `NEXT_PHASE=phase-production-build`.
- **ESLint is pinned to 9.x.** `eslint-plugin-jsx-a11y` has no v10-compatible release.
- **Test baseline:** 408 tests across 31 files. A drop means something was weakened.

---

## 9. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `/api/health` returns 503 `db: disconnected` | `DATABASE_URL` wrong, unpooled, or unreachable | Use the **pooled** endpoint; check Vercel env vars |
| Every path returns 500 `MIDDLEWARE_INVOCATION_FAILED` | `DATABASE_URL` unset at runtime | Set it in Vercel for Production + Preview; redeploy |
| Intermittent connection errors under light load | One `pg.Pool` per serverless instance | Use the pooled endpoint; the pool cap is 5 per instance |
| `npm run lint` prints `ESLint output (JSON parse failed…)` | Output wrapper mangles ESLint | Run `./node_modules/.bin/eslint` directly |
| `npm ci` fails with `ERESOLVE` | ESLint bumped to 10 | Pin back to `^9.39.5` |
| `seed --approve` publishes 40, not 36 | Evidence domain check regressed | Re-run `npm test`; inspect `src/catalog/evidence.ts` |
| A revoked code still returns 200 | Cookie presence-only check | The current middleware validates against the DB — check it wasn't reverted |
| `pg_dump` aborts with "server version mismatch" | pg_dump 15 vs PG 18 server | `brew install postgresql@18`; use `/opt/homebrew/opt/postgresql@18/bin/pg_dump` |
| `$ADMIN_TOKEN` empty in curl | `.env` not sourced | Use `beta-admin.sh` (sources `.env` automatically) |

---

## 10. Known issues

- **`/api/cards` does not filter retracted rule versions.** A card whose only rule version is retracted is still listed. Latent on the host (no retracted rows) but real on a stale local database. Worth its own ticket; not in the MVP scope.
