---
status: accepted
---

# Host on Vercel with a managed Postgres, superseding the single-VPS decision

Issue 39 decided the closed beta would run on **one small VPS in an India region, running `app/docker-compose.yml` unchanged in shape** (caddy under `profiles: [beta]` for HTTPS, ports bound to loopback, `restart: unless-stopped`, daily `pg_dump` rsynced to the steward's laptop, steward psql over an SSH port-forward). That decision was made for a **30-day closed beta with a named cohort and a steward on call** — a single long-lived host that one operator SSHes into.

The destination has since changed. `docs/output/project-status-and-quality-report.md` §7.2 states the target as an **invite-only MVP on a public URL** — no beta window, no cohort, no steward routine, no go-live machinery — and §7.3 records that the earlier VPS decision and the Vercel path are unreconciled, with no map owning the latter. This ADR reconciles them.

## Decision

Host the invite-only MVP on **Vercel**, with a **managed Postgres** (Neon, Supabase, or Vercel Postgres — the provider is not fixed by this ADR) as the database. The VPS decision in Issue 39 is superseded for this effort.

What the earlier decision assumed, and what changed:

| Issue 39 assumed | Why it no longer holds |
|---|---|
| The compose file is the deployed artifact, and local and beta stay byte-for-byte the same stack | Vercel has no equivalent of `docker-compose.yml` or of `app/scripts/docker-entrypoint.sh` (migrate → seed → `seed --approve` → `seed:invites` on every boot). The deploy path has to be built either way; on a VPS it is the entrypoint, on Vercel it is an explicit migration/seed step |
| A single long-lived host, so a steward can `ssh -L 5432:…` and run runbook commands verbatim | There is no beta window and no steward routine in this effort. Runbook access is a one-off operator task, not a recurring one — the SSH port-forward buys nothing |
| PaaS ruled out because it splits the compose into a managed database plus a container | That split is the *point* now: it removes the host-provisioning, TLS-termination, and `pg_dump`-on-cron work that Issues 49, 50 and 51 were going to carry |
| A free pinger on `/api/health` and "restored next business day" | Unchanged in spirit; the uptime probe stays, and becomes an external monitor against the public URL (carried by the Vercel effort's ticket 05) |
| Backups: daily `pg_dump` to the steward's laptop | Replaced by the managed provider's backup plus a rehearsed restore. A backup that has never been restored is not a backup, so the rehearsal stays a criterion |

## Consequences

- **`app/docker-compose.yml` and the Dockerfile stay** for local development; they are no longer the deployed artifact. `docs/runbook.md` §0–16 remains the local path.
- **The migration and seeding path must be made explicit and repeatable.** `docker-entrypoint.sh` does not exist on Vercel, so `npm run migrate`, `npm run seed`, `npm run seed -- --approve` and `npm run seed:invites` need a documented way to run against the hosted database, and a second environment must be stand-up-able without re-deriving it.
- **The connection must be pooled.** `app/src/db/client.ts` opens a `pg.Pool` at module load and throws when `DATABASE_URL` is unset; a pool per serverless instance exhausts the connection limit under light load. Use the provider's pooled endpoint or a pooler.
- **`DATABASE_URL` and `ADMIN_TOKEN` become host environment variables.** `BETA_INVITE_CODES` is read only by `scripts/seed-invites.ts`, never at runtime — codes live in the `invite_codes` table. No secret is committed or bundled into the client.
- **Deployment configuration is still required.** No `vercel.json` exists at the root or in `app/`, and the Next.js app lives in `app/`, so the host needs a root-directory setting or an equivalent config to build the right directory.
- **The India-region preference is dropped.** Issue 39 chose it because it cost nothing; the managed provider's region is now a provider choice, not a constraint this ADR sets.
- **The paused Closed Beta map keeps its history.** Issues 39 and 49–51 are not deleted or rewritten — the VPS decision remains legible as the route the beta effort took, and that map can still be resumed if the 30-day beta comes back into scope. This ADR supersedes it for *this* effort only.
- **Nothing in `CONTEXT.md` changes.** Hosting is an operational decision, not a domain term.

## Carried by

The Vercel MVP effort, `.scratch/vercel-mvp/` — ticket 03 (deploy to Vercel on a managed Postgres), ticket 04 (prove the invite flow end-to-end on the host), ticket 05 (minimum production safety: restore rehearsal, uptime monitor, notice).

## What was rejected and why

| Option | Disposition | Reason |
|---|---|---|
| Keep the single-VPS decision | Rejected | Carries host provisioning, TLS, backup cron and SSH plumbing that this effort has no steward to operate; the beta window it was sized for is not being run |
| Laptop plus tunnel | Rejected | Already rejected in Issue 39 on 30-day uptime; still true for a URL a real person is invited to |
| Leave hosting unrecorded | Rejected | `docs/agents/domain.md`'s rule is that a gate redraw or plan change is recorded, never silent — and the report (§7.3) flags that this exact rule was already broken once in this project |
