# Credit Card Rewards Platform — Quickstart

One command brings up Postgres, applies migrations, seeds the Verified Card Set, loads the invite codes, and serves the app.

## Prerequisites

- Docker (on macOS: Colima or Docker Desktop). Check with `docker ps`.
  If Colima says `Running` but the socket is dead, run `colima restart` — not `colima start`.
- Nothing else on ports `3000` or `5432`. A Homebrew Postgres on 5432 will not break the app
  (the container talks to Postgres over the compose network), but it will hijack host-side
  `psql`/`npm run migrate`. Stop it with `brew services stop postgresql@15`.

## 1. Create `app/.env`

Copy `app/.env.example` to `app/.env`. The full contents:

```bash
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/ccplatform
ADMIN_TOKEN=local-dev-admin-token
BETA_INVITE_CODES=deadbeefdeadbeefdeadbee1,deadbeefdeadbeefdeadbee2,deadbeefdeadbeefdeadbee3,deadbeefdeadbeefdeadbee4,deadbeefdeadbeefdeadbee5
```

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Used by host-side scripts (`npm run migrate`, `seed`, `verify:seed`). Inside the container this is overridden to `postgres:5432`, so leave it as `localhost`. |
| `ADMIN_TOKEN` | Bearer token for every `/api/admin/*` route. |
| `BETA_INVITE_CODES` | Comma-separated. Each must be 24 lowercase hex characters. These are the only codes that unlock the app. |

`.env` is gitignored; `.env.example` is the tracked template.

## 2. Start

```bash
cd app
docker compose up --build -d
docker compose logs -f app     # Ctrl-C once you see "Ready in"
```

On boot the container runs migrations, seeds the cards, walks the Data Leads through the
Publication Gate, and upserts the invite codes. All of it is idempotent, so restarts are safe.

Expected first-boot log markers:

```
Applied: 0000_scaffold.sql … 0006_beta-telemetry.sql   (7 lines)
Data Leads created: 40
Redemption Scenarios created: 62
Published (36):  /  Withheld (4):
Invite codes ready (5): deadbeefdeadbeefdeadbee1, …
✓ Ready in
```

The 4 withheld cards are correct: `inferred` and `community-reported` evidence does not meet
the publication standard (ADR 0003).

## 3. Use it

Open <http://localhost:3000>. You are redirected to `/invite` — paste any code from
`BETA_INVITE_CODES`, for example:

```
deadbeefdeadbeefdeadbee1
```

That sets an httpOnly `beta_access` cookie. The code is re-checked against the database on every
page load of `/`, so revoking a code evicts a live session on the next navigation.

Health check:

```bash
curl -s localhost:3000/api/health     # {"status":"ok","db":"connected"}
```

Admin routes need the token:

```bash
curl -s -H "Authorization: Bearer local-dev-admin-token" localhost:3000/api/admin/invites | jq
```

## Everyday commands

Run from `app/`.

| Command | Effect |
| --- | --- |
| `docker compose up --build -d` | Build and start (also `npm run up`) |
| `docker compose down` | Stop, keep the database |
| `docker compose down -v` | Stop and destroy the database — next boot is a clean slate |
| `docker compose logs -f app` | Follow app logs |
| `docker compose restart app` | Re-run migrate/seed and restart the server |

Code changes require `docker compose up --build -d` to take effect; the image runs a production
build, not a watcher. For iterative frontend work run `npm run dev` on the host instead, with
`docker compose up -d postgres` supplying the database.

## Managing invite codes

Edit `BETA_INVITE_CODES` in `app/.env`, then:

```bash
docker compose up -d --force-recreate app
```

Adding a code inserts it; a code already present is un-revoked. Removing a code from the list
does **not** delete it from the database — revoke it explicitly:

```bash
curl -s -X POST -H "Authorization: Bearer local-dev-admin-token" \
  localhost:3000/api/admin/invites/<code>/revoke
```

## Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| `Cannot connect to the Docker daemon` | Colima VM up, dockerd socket dead | `colima restart` |
| `port is already allocated` on 3000 | A host `next dev` is still running | Stop it, or `docker compose down` |
| Host `psql`/`migrate` sees the wrong data | Homebrew Postgres owns `localhost:5432` | `brew services stop postgresql@15`, then confirm with `psql "$DATABASE_URL" -c 'select version()'` → should say PostgreSQL 16 (Debian) |
| Invite code rejected | Not 24 lowercase hex chars, or revoked | Check `GET /api/admin/invites` |

## Manual path

`docs/runbook.md` is the step-by-step version — every stage run by hand, with verification
queries at each step. Use it when you need to inspect the pipeline rather than just run the app.
