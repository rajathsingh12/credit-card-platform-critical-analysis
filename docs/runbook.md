# Launch & Verification Runbook

How to bring the platform up on Colima + Docker and prove, step by step, what has actually been built.

Every stage has **Run** (what you type) and **Check** (what proves it worked). If a Check fails, stop and fix it before moving on — later stages assume earlier ones passed.

> **Two jobs, two sections.** Sections **0–16** below prove the platform **locally** — the full path, run by hand, with a verification query at each step. Section **A** is the different job: getting it **hosted on Vercel** and safe to invite someone to. If you are working the `.scratch/vercel-mvp/` effort, **start at [§A](#a-building-the-invite-only-vercel-mvp)** — read `.scratch/vercel-mvp/progress.md` before anything else.

---

## 0. Prerequisites

| Tool | Required | Verify with |
|---|---|---|
| Colima | any recent | `colima version` |
| Docker CLI | any recent | `docker --version` |
| Node.js | 20+ (tested on 26.4.0) | `node -v` |
| npm | 10+ (tested on 11.17.0) | `npm -v` |
| jq | optional, used for readable output | `jq --version` |

Everything below runs from the app directory unless stated:

```bash
cd ~/experiments/credit-card-platform-critical-analysis/app
```

### Terminal map

You will keep **four terminals** open. Label them mentally:

| Terminal | Owns | Stays open? |
|---|---|---|
| **A — Infra** | Colima VM + Postgres container | Yes (long-running) |
| **B — Database** | Migrations, seed, verification scripts, psql | No (run and return) |
| **C — App server** | `npm run dev` | Yes (long-running) |
| **D — Checks** | curl calls against the running app | No (run and return) |

---

## 1. Stage 0 — Offline checks (no Docker needed)

Run these first. They need no database and no server, so they isolate code correctness from environment problems.

**Terminal B**

```bash
npm test
npm run typecheck
npm run lint
```

**Check — expected output**

| Command | Expect |
|---|---|
| `npm test` | `Test Files  21 passed (21)` and `Tests  278 passed (278)` |
| `npm run typecheck` | no output after the `> tsc --noEmit` line |
| `npm run lint` | `ESLint: No issues found` |

If all three pass, the calculation engine, publication gate, retraction logic, catalog export, change feed, evidence rules, and API validators are all green **without a database**. Database-backed truth is proven later in Stage 3.

---

## 2. Stage 1 — Start Colima and Postgres

### 2.1 Start the Colima VM

**Terminal A**

```bash
colima status
```

Read the result carefully — there are three possible states:

| State | What you see | Do this |
|---|---|---|
| Not running | `colima is not running` | `colima start` |
| Running and healthy | `colima is running ...` and `docker ps` works | nothing |
| Running but daemon dead | `colima is running ...` but `docker ps` says `Cannot connect to the Docker daemon` | `colima restart` |

If starting fresh, give it enough headroom for Postgres:

```bash
colima start --cpu 2 --memory 4 --disk 60
```

**Check**

```bash
docker context ls
docker ps
```

Expect the `colima` context to carry the `*` marker, and `docker ps` to print a header row with no error. If `docker ps` errors, do not continue — run `colima restart` and re-check.

### 2.2 Start the Postgres container

**Terminal A**

```bash
docker compose up -d postgres
```

This starts `postgres:16` with database `ccplatform`, user/password `postgres`/`postgres`, published on host port `5432`, backed by the named volume `postgres_data`.

**Check**

```bash
docker compose ps
```

Expect one service `postgres` with state `running` and `0.0.0.0:5432->5432/tcp`.

Then prove the server actually accepts connections (the container can be "running" before Postgres is ready):

```bash
docker compose exec postgres pg_isready -U postgres -d ccplatform
```

Expect `/var/run/postgresql:5432 - accepting connections`. If it says `no response`, wait 3 seconds and repeat.

**Check — port conflict**

If `docker compose up` fails with `port is already allocated`, you have another Postgres on 5432. Find it:

```bash
lsof -nP -iTCP:5432 -sTCP:LISTEN
```

Stop that process, or change the host port in `docker-compose.yml` and update `DATABASE_URL` to match.

---

## 3. Stage 2 — Database schema and seed data

### 3.1 Export DATABASE_URL

This is the single most common failure point. The `app/.env` file exists and holds `DATABASE_URL`, but **the Node scripts do not read it** — there is no `dotenv` in this project. `next dev` reads `.env` automatically; `npm run migrate`, `npm run seed`, and `npm run verify:seed` do not.

**Terminal B**

```bash
export DATABASE_URL=postgresql://postgres:postgres@localhost:5432/ccplatform
```

**Check**

```bash
echo $DATABASE_URL
```

Expect the full connection string. If it prints empty, the next three steps will exit with `DATABASE_URL is not set`.

> Re-export this in **every new Terminal B session**. It does not persist.

### 3.2 Apply migrations

```bash
npm run migrate
```

**Check — expected output**

```
Applied: 0000_scaffold.sql
Applied: 0001_core-domain-schema.sql
Applied: 0002_publication-gate.sql
Applied: 0003_verified-card-set.sql
Applied: 0004_beta-invite-gate.sql
Applied: 0005_correction-contextual-reports.sql
Applied: 0006_beta-telemetry.sql
Migrations complete.
```

On a re-run every line becomes `Skipped (already applied): ...`. That is correct and idempotent, not an error.

**Check — tables exist**

```bash
docker compose exec postgres psql -U postgres -d ccplatform -c '\dt'
```

Expect at least: `_migrations`, `cards`, `sources`, `verification_records`, `rule_versions`, `redemption_scenarios`, `data_leads`, `invite_codes`, `contextual_reports`, `correction_history`, `beta_events`.

### 3.3 Seed — step 1 of 2 (prepare, publishes nothing)

The seed is deliberately two-phase, because a Data Lead is not platform knowledge until a Data Steward approves it.

```bash
npm run seed
```

**Check — expected output**

```
Prepared 40 cards with provenance.
  Data Leads created: 40 (already present: 0)
  Redemption Scenarios created: 62

Nothing is published yet. Run "npm run seed -- --approve" to walk the
pending Data Leads through the Publication Gate, or approve them in the admin API.
```

**Check — nothing is public yet**

```bash
docker compose exec postgres psql -U postgres -d ccplatform \
  -c 'SELECT count(*) AS published_rule_versions FROM rule_versions;'
```

Expect `0`. This is the Publication Gate working: 40 cards have provenance, zero are public.

### 3.4 Seed — step 2 of 2 (walk the Publication Gate)

```bash
npm run seed -- --approve
```

This calls the same `publishLead` used by the admin approval route, so the seed cannot publish anything a human steward could not publish by hand.

**Check — expected output shape**

```
Publication Gate processed 40 pending Data Lead(s).

Published (36):
  ✓ American Express Platinum Travel Credit Card
  ... 35 more ...

Withheld (4):
  – <issuer> <card> — <reason>

Verified Card Set: 36 card(s) with a published Rule Version.
  Issuers: ...
  Reward currencies: ...
  Fee bands: ...
  Evidence: ...
```

**The 4 withheld cards are the point, not a bug.** They fail the evidence standard and the gate refuses to publish them. If you see 40 published, the evidence gate has regressed.

**Check — counts in the database**

```bash
docker compose exec postgres psql -U postgres -d ccplatform -c "
SELECT
  (SELECT count(*) FROM cards)                                  AS cards,
  (SELECT count(*) FROM rule_versions)                          AS published,
  (SELECT count(*) FROM data_leads WHERE status = 'pending')    AS withheld_pending,
  (SELECT count(*) FROM redemption_scenarios)                   AS scenarios;"
```

Expect `cards = 40`, `published = 36`, `withheld_pending = 4`, `scenarios = 62`.

### 3.5 Verify the seed against the golden dataset

This is the check that closes the "zero Critical Calculation Errors" exit criterion. Stage 0's unit tests prove the data is right in code; this proves **the database agrees**.

```bash
npm run verify:seed
```

**Check — expected output**

```
Verified 36 published cards against 360 probes
  Issuers: <n>, reward currencies: <n>, fee bands: 3
  Withheld cards with no Rule Version: 4
  Golden cases checked: 5

Zero Critical Calculation Errors.
```

Exit code must be `0`. Confirm it explicitly:

```bash
echo $?
```

If it prints a list of `✗ ...` lines and exits `1`, the database and the declared Verified Card Set have diverged. Do not proceed to the app.

---

## 4. Stage 3 — Configure and start the app server

### 4.1 Add the admin token

`app/.env` currently contains only `DATABASE_URL`. Every `/api/admin/*` route is rejected with `401` unless `ADMIN_TOKEN` is set on the server, because `checkAdminAuth` returns `false` when the variable is missing.

**Terminal B**

```bash
grep -q '^ADMIN_TOKEN=' .env || echo 'ADMIN_TOKEN=local-dev-admin-token' >> .env
```

**Check**

```bash
cat .env
```

Expect two lines:

```
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/ccplatform
ADMIN_TOKEN=local-dev-admin-token
```

> This must be set **before** the dev server starts. The server reads it into `process.env` at boot; adding it later requires a restart.

### 4.2 Start the dev server

**Terminal C** (this terminal is now occupied)

```bash
npm run dev
```

**Check**

Expect `Ready in ...` and a local URL, normally `http://localhost:3000`. If port 3000 is taken, Next.js picks another port — note the actual port and substitute it everywhere below.

### 4.3 Health check

**Terminal D**

```bash
curl -s localhost:3000/api/health | jq
```

**Check**

| Response | Meaning |
|---|---|
| `{"status":"ok","db":"connected"}` (HTTP 200) | app and database are both up |
| `{"status":"error","db":"disconnected"}` (HTTP 503) | Postgres is down or `DATABASE_URL` is wrong — go back to Stage 1 |

### 4.4 Confirm the admin token took effect

```bash
export ADMIN_TOKEN=local-dev-admin-token

curl -s -o /dev/null -w '%{http_code}\n' localhost:3000/api/admin/leads
curl -s -o /dev/null -w '%{http_code}\n' \
  -H "Authorization: Bearer $ADMIN_TOKEN" localhost:3000/api/admin/leads
```

**Check**

Expect `401` then `200`. If the second call also returns `401`, the dev server was started before `ADMIN_TOKEN` was added — restart Terminal C.

---

## 5. Stage 4 — Beta invite gate

This is the step where you generate an invite code and prove the gate works in both directions.

### 5.1 The gate blocks anonymous access

**Terminal D**

```bash
curl -s -o /dev/null -w '%{http_code} -> %{redirect_url}\n' localhost:3000/
```

**Check** — expect `307 -> http://localhost:3000/invite`. Without a `beta_access` cookie, `/` is not reachable.

### 5.2 Generate an invite code

```bash
curl -s -X POST -H "Authorization: Bearer $ADMIN_TOKEN" \
  localhost:3000/api/admin/invites | jq
```

**Check** — HTTP 201 and a body like:

```json
{ "code": { "code": "3f9a1c7d2b8e4f6a0c5d9e21", "createdAt": "...", "revokedAt": null } }
```

The code is exactly **24 lowercase hex characters** (12 random bytes). Anything else will be rejected by the format validator.

Capture it into a shell variable:

```bash
INVITE=$(curl -s -X POST -H "Authorization: Bearer $ADMIN_TOKEN" \
  localhost:3000/api/admin/invites | jq -r '.code.code')
echo $INVITE
```

**Check** — `echo $INVITE` prints 24 hex characters. Verify the format explicitly:

```bash
[[ $INVITE =~ ^[0-9a-f]{24}$ ]] && echo "format OK" || echo "format WRONG"
```

### 5.3 List and audit invite codes

```bash
curl -s -H "Authorization: Bearer $ADMIN_TOKEN" \
  localhost:3000/api/admin/invites | jq '.codes | length, .codes[0]'
```

**Check** — the count matches how many codes you have created, newest first, `revokedAt: null`.

### 5.4 Redeem the code (this is what a beta tester does)

```bash
curl -s -c beta-cookies.txt -X POST \
  -H 'Content-Type: application/json' \
  -d "{\"code\":\"$INVITE\"}" \
  localhost:3000/api/invite/redeem | jq
```

**Check** — `{"ok":true}` and a cookie file written. Confirm the cookie:

```bash
grep beta_access beta-cookies.txt
```

Expect one line containing `beta_access` and your code. The cookie is `httpOnly`, `sameSite=strict`, 30-day max age.

### 5.5 The gate now lets you through

```bash
curl -s -b beta-cookies.txt -o /dev/null -w '%{http_code}\n' localhost:3000/
```

**Check** — expect `200`, not a redirect.

### 5.6 Negative checks (prove the gate actually rejects)

```bash
# Wrong format -> 400
curl -s -X POST -H 'Content-Type: application/json' \
  -d '{"code":"not-a-real-code"}' localhost:3000/api/invite/redeem | jq

# Well-formed but unknown -> 401
curl -s -X POST -H 'Content-Type: application/json' \
  -d '{"code":"000000000000000000000000"}' localhost:3000/api/invite/redeem | jq
```

**Check**

| Input | Expect |
|---|---|
| `not-a-real-code` | HTTP 400, `{"error":"Invalid code format"}` |
| 24 zeros | HTTP 401, `{"error":"Invalid invite code"}` |

### 5.7 Revocation check (run this last — it invalidates the code)

Create a **second** throwaway code so you keep `$INVITE` working:

```bash
TEMP=$(curl -s -X POST -H "Authorization: Bearer $ADMIN_TOKEN" \
  localhost:3000/api/admin/invites | jq -r '.code.code')

curl -s -X POST -H "Authorization: Bearer $ADMIN_TOKEN" \
  localhost:3000/api/admin/invites/$TEMP/revoke | jq

curl -s -X POST -H 'Content-Type: application/json' \
  -d "{\"code\":\"$TEMP\"}" localhost:3000/api/invite/redeem | jq
```

**Check** — revoke returns `{"ok":true}`, then redeem returns HTTP 401 `{"error":"Invite code has been revoked"}`. Revoking twice returns HTTP 404.

Revocation also evicts a live session: `/` re-validates the cookie against the database on every request and redirects to `/invite?revoked=1` if the code is no longer valid.

---

## 6. Stage 5 — Calculation engine over HTTP

### 6.1 List the published cards

**Terminal D**

```bash
curl -s localhost:3000/api/cards | jq '.cards | length'
```

**Check** — expect `36`. This endpoint only returns cards that have a published Rule Version, so the 4 withheld cards must not appear.

```bash
curl -s localhost:3000/api/cards | jq '.cards[0]'
```

Expect `{ id, name, issuer, network, rewardCurrency }` with `id` a UUID.

### 6.2 Run a calculation

Pick a card id, then calculate:

```bash
CARD=$(curl -s localhost:3000/api/cards | jq -r '.cards[0].id')

curl -s -b beta-cookies.txt -X POST \
  -H 'Content-Type: application/json' \
  -d "{\"cardId\":\"$CARD\",\"amountRupees\":2500,\"merchantName\":\"Test Restaurant\",\"merchantCategory\":\"dining\",\"transactionDate\":\"2026-08-22\"}" \
  localhost:3000/api/calculate | jq
```

**Check** — HTTP 200, with a body containing:

| Field | Expect |
|---|---|
| `result.resolved` | `true` for a supported category |
| `result.rewardsEarned` | a non-negative integer |
| `result.ruleApplied` | a Rule Version UUID |
| `result.trace` | a non-empty array — this is the Calculation Trace |
| `ruleMeta[<ruleId>].evidenceStatus` | one of `officially-documented`, `statement-verified`, `inferred`, `community-reported` |
| `ruleMeta[<ruleId>].sourceDate` | `2025-01-01` for seeded cards |
| `ruleMeta[<ruleId>].retractedAt` | `null` |

**Important:** `transactionDate` must be on or after `2025-01-01` — that is `SEED_EFFECTIVE_FROM`. An earlier date produces an Unresolved Outcome because no rule was effective yet.

Valid `merchantCategory` values: `dining`, `travel`, `online`, `grocery`, `entertainment`, `utilities`, `insurance`, `fuel`, `rent`, `wallet-load`, `other`.

### 6.3 Golden-value spot check

These exact values are asserted by `verify:seed`, so they are a reliable cross-check that HTTP returns the same numbers as the engine:

```bash
MILLENNIA=$(curl -s localhost:3000/api/cards \
  | jq -r '.cards[] | select(.issuer=="HDFC Bank" and .name=="Millennia") | .id')

curl -s -b beta-cookies.txt -X POST -H 'Content-Type: application/json' \
  -d "{\"cardId\":\"$MILLENNIA\",\"amountRupees\":2500,\"merchantName\":\"Golden\",\"merchantCategory\":\"dining\",\"transactionDate\":\"2026-08-22\"}" \
  localhost:3000/api/calculate | jq '.result.rewardsEarned'
```

**Check** — expect `2500`.

### 6.4 Input validation (negative checks)

```bash
curl -s -X POST -H 'Content-Type: application/json' -d '{}' \
  localhost:3000/api/calculate | jq

curl -s -X POST -H 'Content-Type: application/json' \
  -d "{\"cardId\":\"$CARD\",\"amountRupees\":-5,\"merchantCategory\":\"dining\",\"transactionDate\":\"2026-08-22\"}" \
  localhost:3000/api/calculate | jq

curl -s -X POST -H 'Content-Type: application/json' \
  -d "{\"cardId\":\"$CARD\",\"amountRupees\":100,\"merchantCategory\":\"dining\",\"transactionDate\":\"22-08-2026\"}" \
  localhost:3000/api/calculate | jq
```

**Check** — all three return HTTP 400 with, respectively, `cardId is required`, `amountRupees must be a positive number`, `transactionDate must be YYYY-MM-DD`.

---

## 7. Stage 6 — Browser walkthrough

Open a browser. Do this after Stage 5 so you already know the API layer is healthy.

### 7.1 Consumer flow

| Step | URL | Check |
|---|---|---|
| 1 | `http://localhost:3000/` | You are redirected to `/invite` |
| 2 | `/invite` | Heading **Beta Access**, one monospace input, disabled **Enter** button |
| 3 | paste `$INVITE`, submit | Redirected to `/`, heading **Credit Card Intelligence Platform** |
| 4 | pick a card, amount, category, date | Outcome card renders |
| 5 | inspect the outcome card | Shows `Resolved` / `Unresolved` state, Reward Value earned (annual fee shown separately), and an **Evidence** badge |
| 6 | expand the trace | Each trace entry shows category, rate, and its own evidence badge |
| 7 | expand **Correction History** | Section toggles open (empty until Stage 8) |
| 8 | click **Report an issue with this rule** | Form appears; on submit shows "Report submitted — thank you. A Data Lead has been created for review." |

Also resize to a mobile width (~390px). The MVP validation strategy calls for the zero-login workflow to work at both desktop and mobile widths.

### 7.2 Steward console

| Step | URL | Check |
|---|---|---|
| 1 | `http://localhost:3000/admin` | Heading **Data Steward Console** with an **Admin token** prompt |
| 2 | submit an empty token | Inline error: "Enter an admin token to continue." |
| 3 | enter a wrong token | Sections load but show "Unauthorized — token is missing, invalid, or not configured on the server." |
| 4 | enter `local-dev-admin-token` | Four sections render: **Data Lead queue**, **Retract a published Rule Version**, **Managed Delivery**, **Report detail** |
| 5 | inspect the Data Lead queue | Shows the 4 withheld cards plus any report-generated leads |

The token is held in browser memory for that tab only — it is never persisted. Reloading the page asks again. That is intended.

---

## 8. Stage 7 — Contextual Reports and the review loop

This proves Phase 3: a cardholder report becomes a Data Lead a steward can act on.

### 8.1 Submit a report

**Terminal D**

```bash
RULE=$(curl -s -b beta-cookies.txt -X POST -H 'Content-Type: application/json' \
  -d "{\"cardId\":\"$CARD\",\"amountRupees\":2500,\"merchantName\":\"Test\",\"merchantCategory\":\"dining\",\"transactionDate\":\"2026-08-22\"}" \
  localhost:3000/api/calculate | jq -r '.result.ruleApplied')

curl -s -b beta-cookies.txt -X POST -H 'Content-Type: application/json' \
  -d "{\"cardId\":\"$CARD\",\"ruleVersionId\":\"$RULE\",\"description\":\"Dining rate looks lower than my statement\",\"sourceUrl\":\"https://example.com/statement\"}" \
  localhost:3000/api/reports | jq
```

**Check** — HTTP 201 with `{ reportId, dataLeadId, createdAt }`. Both ids are UUIDs. One report creates **both** a `contextual_reports` row and a linked pending `data_leads` row, in a single transaction.

### 8.2 Confirm it reached the steward queue

```bash
curl -s -H "Authorization: Bearer $ADMIN_TOKEN" localhost:3000/api/admin/leads \
  | jq '.leads | length'
```

**Check** — expect `5` (the 4 withheld seed cards + your new report lead).

### 8.3 Read the full report detail

```bash
REPORT=<paste the reportId from 8.1>

curl -s -H "Authorization: Bearer $ADMIN_TOKEN" \
  localhost:3000/api/admin/reports/$REPORT | jq
```

**Check** — the response nests `card`, `ruleVersion` (with `ruleData`, `effectiveFrom`, `retractedAt`) and `verificationRecord` (with `evidenceStatus`, `verifiedAt`). This is what lets a steward judge the report without leaving the console.

### 8.4 Negative checks

```bash
curl -s -X POST -H 'Content-Type: application/json' \
  -d '{"description":"missing card"}' localhost:3000/api/reports | jq

curl -s -X POST -H 'Content-Type: application/json' \
  -d '{"cardId":"00000000-0000-0000-0000-000000000000","description":"unknown card"}' \
  localhost:3000/api/reports | jq
```

**Check** — HTTP 400 `cardId and description are required`, then HTTP 404 `card not found`.

---

## 9. Stage 8 — Publication Gate and Correction History

### 9.1 Walk a withheld lead through verification

Take one of the 4 pending seed leads:

```bash
LEAD=$(curl -s -H "Authorization: Bearer $ADMIN_TOKEN" localhost:3000/api/admin/leads \
  | jq -r '.leads[0].id')

curl -s -X POST -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"evidenceStatus":"officially-documented","notes":"runbook check"}' \
  localhost:3000/api/admin/leads/$LEAD/verify | jq
```

**Check** — two possible correct outcomes, both meaningful:

| Response | Meaning |
|---|---|
| HTTP 201 with `verificationRecord` | evidence passed the domain check |
| HTTP 422 with an evidence error | the lead's `sourceUrl` is not on the issuer's official domain — **this is the gate working** |

Try an invalid status to confirm validation:

```bash
curl -s -X POST -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H 'Content-Type: application/json' -d '{"evidenceStatus":"probably-true"}' \
  localhost:3000/api/admin/leads/$LEAD/verify | jq
```

**Check** — HTTP 400 listing the four allowed statuses.

### 9.2 Approve or reject

```bash
# Approve (only succeeds if verification passed and evidence meets the standard)
curl -s -X POST -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H 'Content-Type: application/json' -d '{"effectiveFrom":"2026-08-22"}' \
  localhost:3000/api/admin/leads/$LEAD/approve | jq

# Reject (requires a reason)
curl -s -X POST -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H 'Content-Type: application/json' -d '{"reason":"source is a blog, not the issuer"}' \
  localhost:3000/api/admin/leads/$LEAD/reject | jq
```

**Check — status code mapping**

| Situation | HTTP |
|---|---|
| bad or missing `effectiveFrom` | 400 |
| lead id does not exist | 404 |
| lead is not pending | 422 |
| evidence below the publication standard | 422 |
| approve succeeds | 200 with `ruleVersion` |
| reject without a reason | 422 |

### 9.3 Retract a published rule and see the correction surface

This is the highest-value end-to-end check: a correction must make prior outcomes unresolved **without destroying history**.

```bash
curl -s -X POST -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"reason":"Runbook check — cap was misread from the issuer terms"}' \
  localhost:3000/api/admin/rule-versions/$RULE/retract | jq
```

**Check** — HTTP 200 with `{ correctionHistoryId, retractedAt }`.

Now re-run the exact same calculation from 6.2:

```bash
curl -s -b beta-cookies.txt -X POST -H 'Content-Type: application/json' \
  -d "{\"cardId\":\"$CARD\",\"amountRupees\":2500,\"merchantName\":\"Test\",\"merchantCategory\":\"dining\",\"transactionDate\":\"2026-08-22\"}" \
  localhost:3000/api/calculate | jq '.result.resolved, .result.reason'
```

**Check** — `resolved` flips to `false` with reason `"The rule used for this calculation has been retracted due to a correction."` The trace and the prior reward figure are still present — nothing was deleted.

Confirm it is public:

```bash
curl -s localhost:3000/api/correction-history | jq '.entries[0]'
```

**Check** — one entry with `ruleVersionId`, `retractionReason`, `retractedAt`, and the `card`. This endpoint needs no auth — Correction History is public by design.

In the browser, reload `/` and expand **Correction History**; the entry appears there too.

**Check — idempotency**

Retract the same rule again:

```bash
curl -s -o /dev/null -w '%{http_code}\n' -X POST \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' \
  -d '{"reason":"second attempt"}' \
  localhost:3000/api/admin/rule-versions/$RULE/retract
```

Expect `409`. A missing rule id gives `404`; an empty reason gives `400`.

---

## 10. Stage 9 — Managed B2B delivery

### 10.1 Versioned Catalog export

```bash
curl -s -D - -H "Authorization: Bearer $ADMIN_TOKEN" \
  localhost:3000/api/admin/catalog-export -o catalog.json | grep -i 'content-disposition'

jq '{version: .catalogVersion, cards: (.cards | length)}' catalog.json
```

**Check** — the header carries `attachment; filename="catalog-<version>.json"`, and the parsed body reports the published card count. Inspect one card:

```bash
jq '.cards[0] | {issuer, name, rewardCurrency, ruleVersions: (.ruleVersions | length), redemptionScenarios: (.redemptionScenarios | length)}' catalog.json
```

Every card must carry its Rule Versions and Redemption Scenarios — a Versioned Catalog preserves prior versions rather than replacing them.

### 10.2 Change Feed

```bash
# Missing parameter -> 400
curl -s localhost:3000/api/admin/change-feed \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq

# Bad date -> 400
curl -s "localhost:3000/api/admin/change-feed?since=not-a-date" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq

# Valid window
curl -s "localhost:3000/api/admin/change-feed?since=2025-01-01" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq '{sinceDate, feedDate, changes: (.changes | length)}'

# Explicit end date
curl -s "localhost:3000/api/admin/change-feed?since=2025-01-01&until=2026-08-22" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq '{sinceDate, feedDate}'
```

**Check**

| Call | Expect |
|---|---|
| no `since` | 400, `Missing required query parameter: since (YYYY-MM-DD)` |
| `since=not-a-date` | 400, `Invalid date format for "since" parameter...` |
| `since=2025-01-01` | 200, `changes` includes the 36 seeded publications |
| with `until` | 200, `feedDate` equals the `until` you supplied |

The retraction from Stage 8.3 must appear in the feed. That was a deliberate fix — a Data Customer needs to see retractions, not just publications.

---

## 11. Stage 10 — Beta telemetry and the Phase Gate metric

### 11.1 Confirm events were recorded

Your calculations in Stage 5 and the report in Stage 7 emitted telemetry automatically (server-side, best-effort).

**Terminal B**

```bash
docker compose exec postgres psql -U postgres -d ccplatform -c "
SELECT event_name, count(*) FROM beta_events GROUP BY event_name ORDER BY 1;"
```

**Check** — expect rows for at least `decision_completed`, plus `unresolved_outcome_shown` (from the retraction), `contextual_report_submitted`, `correction_retracted`, and `session_repeat` if you calculated more than once with the same cookie.

### 11.2 Client telemetry endpoint

**Terminal D**

```bash
curl -s -b beta-cookies.txt -X POST -H 'Content-Type: application/json' \
  -d '{"eventName":"decision_completed","payload":{"source":"runbook"}}' \
  localhost:3000/api/telemetry | jq

curl -s -X POST -H 'Content-Type: application/json' \
  -d '{"eventName":"correction_retracted"}' localhost:3000/api/telemetry | jq

curl -s -X POST -H 'Content-Type: application/json' \
  -d '{"eventName":"made_up_event"}' localhost:3000/api/telemetry | jq
```

**Check**

| Event | Expect |
|---|---|
| `decision_completed` | HTTP 201 `{"ok":true}` |
| `correction_retracted` | HTTP 400 — server-only event, clients cannot forge it |
| `made_up_event` | HTTP 400 `invalid eventName` |

### 11.3 Phase 4 gate query

The gate is: at least 50% of beta cardholders complete three or more decisions within 30 days.

```bash
docker compose exec postgres psql -U postgres -d ccplatform -c "
SELECT
  COUNT(*) FILTER (WHERE decisions >= 3) AS met_gate,
  COUNT(*) AS total_sessions,
  ROUND(100.0 * COUNT(*) FILTER (WHERE decisions >= 3) / NULLIF(COUNT(*), 0), 1) AS pct_met
FROM (
  SELECT session_token, COUNT(*) AS decisions
  FROM beta_events
  WHERE event_name = 'decision_completed'
    AND occurred_at >= NOW() - INTERVAL '30 days'
  GROUP BY session_token
) per_session;"
```

**Check** — the query runs and returns a row. With only your own runbook session the percentage is not meaningful; what you are verifying is that the instrumentation supports the gate metric.

Correction turnaround:

```bash
docker compose exec postgres psql -U postgres -d ccplatform -c "
SELECT ch.id, ch.card_id, ch.retracted_at,
       MIN(rv.effective_from) AS next_published_date,
       MIN(rv.effective_from) - ch.retracted_at::date AS turnaround_days
FROM correction_history ch
LEFT JOIN rule_versions rv
  ON rv.card_id = ch.card_id AND rv.retracted_at IS NULL AND rv.effective_from > ch.retracted_at::date
GROUP BY ch.id, ch.card_id, ch.retracted_at;"
```

---

## 12. Stage 11 — Production build check

Dev mode hides build-time errors. Confirm the app actually builds.

**Terminal C** — stop `npm run dev` with `Ctrl+C`, then:

```bash
npm run build
```

**Check** — build completes with a route table and no errors. Then:

```bash
npm start
curl -s localhost:3000/api/health | jq
```

Expect `{"status":"ok","db":"connected"}` again. Stop with `Ctrl+C` and return to `npm run dev` for further work.

---

## 13. Full-pass summary sheet

Run this after a complete pass. Everything should be green.

| # | Check | Command | Pass condition |
|---|---|---|---|
| 1 | Unit tests | `npm test` | 21 files, 278 tests passed |
| 2 | Types | `npm run typecheck` | no output |
| 3 | Lint | `npm run lint` | `No issues found` |
| 4 | Docker daemon | `docker ps` | no connection error |
| 5 | Postgres ready | `docker compose exec postgres pg_isready -U postgres -d ccplatform` | accepting connections |
| 6 | Migrations | `npm run migrate` | 7 applied or skipped, `Migrations complete.` |
| 7 | Seed prepared | `npm run seed` | 40 cards, 62 scenarios, 0 published |
| 8 | Publication Gate | `npm run seed -- --approve` | 36 published, 4 withheld |
| 9 | Golden verification | `npm run verify:seed` | `Zero Critical Calculation Errors.`, exit 0 |
| 10 | Health | `curl localhost:3000/api/health` | `status: ok`, `db: connected` |
| 11 | Admin auth | unauth vs auth `/api/admin/leads` | `401` then `200` |
| 12 | Invite gate blocks | `curl -o /dev/null -w '%{http_code}' localhost:3000/` | `307` to `/invite` |
| 13 | Invite generate | `POST /api/admin/invites` | 201, 24-hex code |
| 14 | Invite redeem | `POST /api/invite/redeem` | `{"ok":true}` + cookie |
| 15 | Invite gate opens | `curl -b beta-cookies.txt localhost:3000/` | `200` |
| 16 | Invite revoke | revoke then redeem | `{"ok":true}` then 401 revoked |
| 17 | Published cards | `GET /api/cards` | 36 |
| 18 | Calculate | `POST /api/calculate` | resolved, non-empty trace, evidence status |
| 19 | Validation | malformed calculate bodies | 400 with the specific message |
| 20 | Report → lead | `POST /api/reports` | 201, lead queue grows to 5 |
| 21 | Retraction | `POST .../retract` | 200, then re-calculate is unresolved |
| 22 | Correction History | `GET /api/correction-history` | entry present, no auth needed |
| 23 | Catalog export | `GET /api/admin/catalog-export` | attachment header + versioned cards |
| 24 | Change feed | `GET /api/admin/change-feed?since=2025-01-01` | 200 with changes; 400 without `since` |
| 25 | Telemetry allowlist | forge `correction_retracted` | 400 |
| 26 | Production build | `npm run build && npm start` | builds, health ok |

---

## 14. Teardown

```bash
# Terminal C
Ctrl+C                      # stop the dev server

# Terminal A
docker compose stop         # stop Postgres, keep the data volume
colima stop                 # stop the VM
```

To wipe the database and start completely clean:

```bash
docker compose down -v      # WARNING: deletes the postgres_data volume and all seeded data
```

After `down -v`, you must redo Stage 2 in full (migrate, seed, seed --approve, verify:seed).

Clean up the scratch files this runbook created:

```bash
rm -f beta-cookies.txt catalog.json
```

---

## 15. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `Cannot connect to the Docker daemon` while `colima status` says running | VM up, Docker daemon inside is dead | `colima restart` |
| `DATABASE_URL is not set` from `npm run migrate/seed/verify:seed` | Node scripts do not read `.env`; there is no dotenv in this project | `export DATABASE_URL=...` in that terminal |
| App starts but `/api/health` returns 503 | Postgres not ready, or wrong port | `docker compose ps`, `pg_isready`, check port 5432 |
| Every `/api/admin/*` returns 401 even with the right token | `ADMIN_TOKEN` missing from `.env`, or dev server started before it was added | add to `.env`, restart Terminal C |
| `port is already allocated` on 5432 | another Postgres is running | `lsof -nP -iTCP:5432 -sTCP:LISTEN`, stop it or remap the port |
| `npm run seed -- --approve` publishes 40, not 36 | evidence domain check has regressed | re-run `npm test` and inspect `src/catalog/evidence.ts` |
| `verify:seed` lists `✗` errors | database rows and the declared Verified Card Set diverged | `docker compose down -v`, then redo Stage 2 |
| Calculation always Unresolved | `transactionDate` earlier than `2025-01-01`, or an unsupported category | use a date ≥ 2025-01-01 and a category from the list in 6.2 |
| `/` keeps redirecting to `/invite?revoked=1` | your invite code was revoked | generate and redeem a fresh code |
| Browser admin console shows Unauthorized | wrong token typed in the browser | it must match `ADMIN_TOKEN` in `.env` exactly |
| Next.js picks port 3001 | 3000 already in use | substitute the real port in every curl above |

---

## 16. What is deliberately not built

Do not treat these as failures during verification:

| Area | State | Reference |
|---|---|---|
| Payment channel in reward rules | Not modeled; the form has no channel field | issue 32, `needs-info` |
| Month-to-date spend / milestone caps | Not modeled; the form has no MTD field | issue 33, `needs-info` |
| Phase 0 human gate items (compliance review, named Data Steward, beta cohort) | Awaiting a human decision | issue 01, `ready-for-human` |
| Portfolio Optimization, consumer billing, affiliate flows, bank linking, self-serve public API, historical "as of" calculations | Explicit MVP non-goals | `docs/mvp-implementation-plan.md` |
| The 4 withheld cards | Correctly blocked by the evidence standard | `npm run seed -- --approve` output |

---

## A. Building the invite-only Vercel MVP

Sections 0–16 above bring the platform up **locally** and prove what is built. This section is the different job: getting it **hosted and safe to invite someone to**. It is the runbook for the `.scratch/vercel-mvp/` effort.

**Destination:** the platform on a public Vercel URL, invite code as the real access boundary, with backups and an uptime probe. Not the Closed Beta — that is a separate, paused effort.

### A.0 The handoff file — read this before anything else

Every session starts by reading **`.scratch/vercel-mvp/progress.md`**. It holds what is done, what is next, and what the last session learned. It plus your ticket is the entire orientation.

**Do not re-explore the repo to work out where things stand.** That is what the progress file is for. If something is missing from it, add it — that is the fix, not a fresh exploration next time.

| File | What it is |
|---|---|
| `.scratch/vercel-mvp/progress.md` | **The handoff.** Status table, frontier, standing facts, session log |
| `.scratch/vercel-mvp/map.md` | Destination, decisions, scope boundaries |
| `.scratch/vercel-mvp/issues/NN-*.md` | The ticket you are working |
| `docs/output/project-status-and-quality-report.md` | Where these tickets came from; the verified state of the repo |

> `.scratch/` is gitignored, so the progress file is local-only. That is fine — it is a working document for the agent on this machine, not a deliverable.

### A.1 How a session runs

One ticket per session. `/clear` between tickets.

**Start.** Read `.scratch/vercel-mvp/progress.md`, then your ticket. Set the ticket's `Status:` to `claimed` before doing any work.

**Work.** Run the `/implement` prompt below, substituting the ticket path.

**End — this is the part that makes the next session cheap.** Do all four:

1. Run all four gates from `app/`: `npm run lint && npm run typecheck && npm test && npm run build`.
2. Set the ticket's `Status:` to `done` and tick its criteria — only the ones you actually ran.
3. Update the status table and the frontier in `.scratch/vercel-mvp/progress.md`.
4. Append one session-log entry: what changed, the commit hash, and anything the next session would otherwise have to rediscover.

Step 3 and 4 are not bookkeeping. Skip them and the next session starts by re-deriving what you already knew — which is exactly what this file exists to prevent.

**Reading a gate result.** `npm run lint` can print `ESLint output (JSON parse failed: ...)` and report a false failure — a wrapper in this environment mangles ESLint's output. Do not trust a wrapped gate result. Run the binary directly and read its exit code:

```bash
cd app
./node_modules/.bin/tsc --noEmit    # typecheck
./node_modules/.bin/vitest run      # tests
./node_modules/.bin/eslint          # lint
./node_modules/.bin/next build      # build
```

### A.2 The per-ticket prompt

`/clear` first. Then paste, substituting the ticket path:

```
/implement .scratch/vercel-mvp/issues/<NN-slug>.md

Orient from .scratch/vercel-mvp/progress.md first — it has the status, the frontier, and the
standing facts. Do not re-explore the repo to work out what is already done.

Stay inside the ticket. Repo invariants: vitest stays DB-free (DB checks go in app/scripts/ with
DATABASE_URL exported), rank by Reward Value never fee-amortized "effective cost", do not modify
the Calculation Engine or its result type.

Before claiming done: run npm run lint, npm run typecheck, npm test and npm run build from app/.
Do not tick a box you did not run. Then update the ticket status and .scratch/vercel-mvp/progress.md
(status table, frontier, and a session-log entry with the commit).
```

`/implement` drives `/tdd` and `/code-review` internally and commits.

### A.3 Which session for which ticket

| Ticket | Session | Depends on | Roughly |
|---|---|---|---|
| 01 Green the build and CI | own session | — | 30 min |
| 06 Reconcile the tracker with reality | own session | — | 1 h |
| 02 Close the access-control holes | own session | 01 | 1–2 h |
| 03 Deploy to Vercel on a managed Postgres | own session | 01 | 1–2 days |
| 04 Prove the invite-only flow end-to-end | own session | 02, 03 | half a day |
| 05 Minimum production safety | own session | 03 | 1 day |

**01 and 06 can run now, in either order.** They are independent. Do 01 first if you want the build green immediately — it is a dead import plus a dependency-version fix.

**03 is the long one.** It has the most failure modes (pooling, migrations on a serverless host, secrets) and the least code. Budget for it, and expect to use `/wizard` for the parts only a human can do.

### A.4 Skills this effort uses

| Skill | When |
|---|---|
| `/implement <ticket>` | Every ticket. Drives `/tdd` and `/code-review`, then commits |
| `/wizard` | Steps only a human can take — provisioning the host, setting secrets, clicking through a provider dashboard. Ticket 03 is the main one |
| `/diagnosing-bugs` | Something resists a first look. It insists on a tight feedback loop before theorising |
| `/grilling` + `/domain-modeling` | Only if a ticket turns out to rest on an undecided question |

Not `/triage` — these tickets are already agent-ready. Not `/wayfinder` — the map is charted; this is execution.

### A.5 When a ticket is wrong

If a ticket turns out to be mis-scoped, split it or add a new one, then update `progress.md` in the same session. The tracker is the plan — leaving it stale is how the last effort ended up with three tickets marked `ready-for-agent` that were already built, and a later session would have rebuilt them.

### A.6 Definition of done for the whole effort

The effort is complete when all of these hold on the **deployed host**, not locally:

- [ ] An invite code is the real access boundary — an unauthenticated request to a data endpoint returns 401.
- [ ] Redeeming a code grants access; revoking it evicts a live session.
- [ ] A calculation completes with its Calculation Trace and Evidence Status, matching local output.
- [ ] A contextual report submitted from the host lands in the steward queue.
- [ ] A backup has been taken **and a restore rehearsed**.
- [ ] An uptime monitor watches the health probe.
- [ ] The invite page carries the plain-language notice, and the verified-date shown is truthful.

Ticket 04 is the acceptance test; the rest is what makes it safe to leave running.

### A.7 What this effort is not

Do not pull these in — they belong to other efforts or are ruled out:

| Excluded | Why |
|---|---|
| Running the Closed Beta (30-day window, Phase-4 gate verdict, cohort) | Separate paused effort; `.scratch/mvp/` |
| Payment Strategy ticket 07 (catalog/change-feed for routes) | Phase-5-facing and dormant |
| Phase 5 Managed B2B Pilot, Phase 6 Portfolio Optimization | Beyond the MVP Boundary |
| Issues 32, 33 (channel-aware rules, month-to-date caps) | `needs-info`, no trigger |
| The full launch-compliance review | Deferred to before public launch; this effort carries only the notice |

---

## A.8 Gate reference — how to read a gate result

Run every gate from `app/`. Two ways, and the second is the one you trust.

**Convenience (as the workflow runs them):**

```bash
cd app
npm run typecheck && npm run lint && npm test && npm run build
```

**Trustworthy — the binaries, with real exit codes.** The `npm run` wrapper in this environment mangles ESLint's output into `ESLint output (JSON parse failed: EOF while parsing a value at line 1 column 0)` and reports a **false FAIL**. It cost a verification pass on ticket 01. When a gate matters, run the binary:

```bash
cd app
./node_modules/.bin/tsc --noEmit     ; echo "typecheck exit $?"
./node_modules/.bin/vitest run       ; echo "test      exit $?"
./node_modules/.bin/eslint           ; echo "lint      exit $?"
./node_modules/.bin/next build       ; echo "build     exit $?"
```

All four must print `exit 0`. One-liner that fails loudly:

```bash
cd app
./node_modules/.bin/tsc --noEmit && ./node_modules/.bin/eslint && \
./node_modules/.bin/vitest run && ./node_modules/.bin/next build \
&& echo "ALL FOUR GATES GREEN" || echo "GATE FAILED"
```

| Gate | Baseline to preserve |
|---|---|
| typecheck | exit 0 |
| tests | **370 passed across 27 files.** A drop means something was weakened |
| lint | exit 0, no output |
| build | exit 0, emits a route table |

**ESLint is pinned to `^9.39.5` on purpose.** `eslint-plugin-jsx-a11y` (6.10.2, its latest release) accepts only up to ESLint 9. Bumping ESLint to 10 re-breaks `npm ci` and CI with it.

**Local stack, if a ticket needs a running app.** Sections 0–7 above are the full path: Colima VM, Postgres container on 5432, `export DATABASE_URL=...`, `npm run migrate`, `npm run seed`, `npm run seed -- --approve`, `npm run seed:invites`, then `npm run dev` on port 3000. Scripts do **not** read `.env` — export `DATABASE_URL` in the terminal that runs them.

---

## A.9 Ticket 01 — Green the build and CI  ·  DONE

**Status: `done`.** Commit `cdcf5ae`. Verified 2026-10-13. Nothing to run.

| Criterion | Evidence |
|---|---|
| lint exits 0 | `./node_modules/.bin/eslint` → exit 0 |
| build exits 0 | `./node_modules/.bin/next build` → exit 0, route table emitted |
| `npm ci` resolves without `--legacy-peer-deps` | Proved in a scratch dir: exit 0, zero `ERESOLVE` |
| CI runs green | Run [38468015819](https://github.com/rajathsingh12/credit-card-platform-critical-analysis/actions/runs/38468015819) on `f842bdd` — all 7 steps executed, **370 tests passed in CI**, 104s. The previous 8 runs all died at *Install dependencies* in 29s |
| 370 tests still pass | `Tests 370 passed (370)` |
| Dead import removed, not suppressed | `app/src/engine/periodic-cap.ts` — import deleted |

**What changed:** dropped the unused `CapPeriod` import; pinned `eslint` to `^9.39.5`; removed the dead `--legacy-peer-deps` from `app/Dockerfile`.

**Side effect worth knowing for ticket 03:** the Edge-runtime `crypto` warning is gone — the build now emits no warnings at all.

---

## A.10 Ticket 02 — Close the access-control holes

**Blocked by:** nothing (01 is done). **Roughly 1–2 h.** This is a code ticket — `/implement` drives it.

### A.10.1 Prove the hole before fixing it

Never fix a security bug you have not watched succeed. Start the app (§4.2, `npm run dev`), then from **Terminal D**:

```bash
# Data endpoints — expect 200 today. That IS the bug.
curl -s -o /dev/null -w 'cards              %{http_code}\n' localhost:3000/api/cards
curl -s -o /dev/null -w 'correction-history %{http_code}\n' localhost:3000/api/correction-history
curl -s -o /dev/null -w 'calculate          %{http_code}\n' -X POST \
  -H 'Content-Type: application/json' \
  -d '{"cardId":"00000000-0000-0000-0000-000000000000","amountRupees":100,"merchantCategory":"dining","transactionDate":"2026-01-01"}' \
  localhost:3000/api/calculate
curl -s -o /dev/null -w 'reports            %{http_code}\n' -X POST \
  -H 'Content-Type: application/json' \
  -d '{"cardId":"00000000-0000-0000-0000-000000000000","description":"probe"}' \
  localhost:3000/api/reports

# Admin console shell — expect 200 today. The shell should not be public.
curl -s -o /dev/null -w 'admin shell        %{http_code}\n' localhost:3000/admin

# Health — must stay open. This one is correct at 200.
curl -s -o /dev/null -w 'health             %{http_code}\n' localhost:3000/api/health
```

Write the numbers down. They are the before-column of the proof.

### A.10.2 The fix

The gate lives in `app/src/middleware.ts`. Its matcher is currently:

```js
export const config = { matcher: ['/', '/api/admin/:path*'] }
```

That covers the home page and the admin API — and nothing else. Read the ticket for the acceptance criteria; the shape of the fix is:

- **Extend the matcher** to the data endpoints (`/api/calculate`, `/api/cards`, `/api/reports`, `/api/telemetry`, `/api/correction-history`) and the `/admin` page shell.
- **Keep `/api/health` open** — an uptime monitor has no invite code.
- **Validate, don't just check presence.** Today `middleware.ts` only asks whether the cookie exists, and `page.tsx` asks the database. A revoked code must not survive on a stale cookie, so the API path needs the same database check the page path already does.
- **Set `secure: true`** on the cookie in `app/src/app/api/invite/redeem/route.ts` (currently `httpOnly`, `sameSite: 'strict'`, `path: '/'`, `maxAge` 30 days — no `secure`). It must not break plain-HTTP local dev.
- **Rate limit** the write paths per session.

`/api/calculate` and `/api/telemetry` already read the cookie — but only to tag telemetry, never to authorise. Do not mistake that for gating.

### A.10.3 Prove the fix

```bash
# Every data endpoint — expect 401
for p in cards correction-history; do
  curl -s -o /dev/null -w "$p %{http_code}\n" "localhost:3000/api/$p"
done
curl -s -o /dev/null -w 'calculate %{http_code}\n' -X POST \
  -H 'Content-Type: application/json' \
  -d '{"cardId":"x","amountRupees":100,"merchantCategory":"dining","transactionDate":"2026-01-01"}' \
  localhost:3000/api/calculate

# Health — expect 200
curl -s -o /dev/null -w 'health %{http_code}\n' localhost:3000/api/health

# With a real session — expect 200. Redeem a code first (§5.2, §5.4).
curl -s -b beta-cookies.txt -o /dev/null -w 'cards (with session) %{http_code}\n' \
  localhost:3000/api/cards

# Revocation must evict a live session. Revoke the code (§5.7), then:
curl -s -b beta-cookies.txt -o /dev/null -w 'cards (revoked) %{http_code}\n' \
  localhost:3000/api/cards
```

**Check** — the last one must be 401. If a revoked code still returns 200, the presence-check survived and the fix is incomplete.

### A.10.4 Done means

- Every data endpoint 401s without a session; health stays 200.
- A revoked code evicts a live session, proved above.
- The `/admin` shell is not served unauthenticated.
- The cookie sets `secure` under HTTPS without breaking local HTTP.
- Write paths are rate limited.
- All four gates green (A.8). Existing tests updated to carry a session — **not** weakened.

---

## A.11 Ticket 03 — Deploy to Vercel on a managed Postgres

**Blocked by:** nothing (01 is done). **Roughly 1–2 days.** The longest ticket, and **the one that needs you at the keyboard** — `/wizard` handles the parts only a human can click.

### A.11.1 What makes this hard

The app has only ever run locally. Three things have no local equivalent:

1. **Migrations.** Locally, `scripts/docker-entrypoint.sh` runs migrate → seed → approve → seed-invites on container boot. Vercel has no entrypoint. Migrations must run against the hosted database by hand or from a build step.
2. **Connection pooling.** `src/db/client.ts` opens a `pg.Pool` at module load. Serverless instances multiply — a naive pool exhausts the Postgres connection limit. Use the provider's pooled endpoint.
3. **`DATABASE_URL` at import time.** `client.ts` throws if it is unset, which on serverless surfaces as a build or cold-start failure rather than a clean error.

### A.11.2 Sequence

**Step 1 — provision.** Use `/wizard`. It generates an interactive script that opens each URL, captures each value, and writes it into `.env` and GitHub secrets. You need:

- A Vercel project pointed at this repo, with the **root directory set to `app/`**.
- A managed Postgres with a **pooled** connection string.
- Env vars: `DATABASE_URL` (pooled), `ADMIN_TOKEN`, `BETA_INVITE_CODES`.

**Step 2 — run migrations against the hosted database.** From `app/`, with the hosted URL exported:

```bash
export DATABASE_URL='<hosted pooled connection string>'
npm run migrate
```

**Check** — the runner prints each applied migration:

```bash
export DATABASE_URL='<hosted>'
npm run migrate          # expect 7 lines: 0000_scaffold.sql … 0006_beta-telemetry.sql
```

**Step 3 — seed.** Same shell, in order:

```bash
npm run seed                    # prepares cards + Data Leads; publishes nothing
npm run seed -- --approve       # walks the Publication Gate
npm run seed:invites            # upserts the codes in BETA_INVITE_CODES
```

**Check** — expect `Published (36)` and `Withheld (4)`. The 4 are correct: `inferred` and `community-reported` evidence does not meet the publication standard (ADR 0003). If it publishes 40, the evidence domain check has regressed — stop.

```bash
npm run verify:seed             # golden-dataset check against the hosted rows
```

**Check** — no `✗` lines.

**Step 4 — deploy.** Push; Vercel builds `app/`. Watch the build log.

**Step 5 — verify the host.**

```bash
HOST='https://<your-app>.vercel.app'

curl -s "$HOST/api/health" | jq
# expect: { "status": "ok", "db": "connected" }
```

A `503` with `db: disconnected` means `DATABASE_URL` is wrong, unpooled, or the database is unreachable from Vercel.

```bash
curl -s -o /dev/null -w 'root %{http_code} -> %{redirect_url}\n' "$HOST/"
# expect: 307 -> $HOST/invite
```

### A.11.3 The migration/seeding path must be repeatable

Whatever you settle on — a documented manual run, or a protected admin endpoint — write it down in the ticket's resolution comment. A second environment must be standable-up without re-deriving it.

### A.11.4 Done means

- Public HTTPS URL; `/api/health` reports `db: connected`.
- Hosted database has migrations applied and 36 published cards + invite codes.
- Secrets set in the host, not committed; no secret in the client bundle.
- Deployment config exists and builds the right directory.
- Redeploy after a code change picks it up.
- Migration/seeding path documented and repeatable.

### A.11.5 Watch out for

- **The Edge-runtime `crypto` import.** `app/src/beta/invite.ts` imports Node `crypto`, and middleware runs on Edge by default. The build warning is currently gone, but ticket 02 makes middleware do *more* — confirm it still works on the deployed host, not just locally.
- **Cold-start pool exhaustion.** If you see intermittent connection errors under light load, the pool is the cause, not the database.

---

## A.12 Ticket 04 — Prove the invite-only flow end-to-end on the host

**Blocked by:** 02, 03. **Roughly half a day.** Mostly verification. **This is the acceptance test for the whole MVP** — the one ticket that proves the product does what it claims.

Every check below runs against `HOST`, never localhost. A green local run is **not** the same claim, and that distinction has already mattered once in this project.

### A.12.1 No code, no session

```bash
HOST='https://<your-app>.vercel.app'

# 1. Anonymous root redirects to the invite page
curl -s -o /dev/null -w 'root   %{http_code} -> %{redirect_url}\n' "$HOST/"
# expect: 307 -> $HOST/invite

# 2. Data endpoints refuse an anonymous caller
for p in cards correction-history; do
  curl -s -o /dev/null -w "$p %{http_code}\n" "$HOST/api/$p"
done
# expect: 401 each

# 3. Health stays open
curl -s -o /dev/null -w 'health %{http_code}\n' "$HOST/api/health"
# expect: 200
```

### A.12.2 Redeem a code on the host

```bash
# Issue a code (needs the admin token)
curl -s -X POST -H "Authorization: Bearer $ADMIN_TOKEN" "$HOST/api/admin/invites" \
  | jq -r '.code.code' > /tmp/invite.txt

CODE=$(cat /tmp/invite.txt); echo "code: $CODE"

# Redeem it, capturing the cookie
curl -s -c beta-host-cookies.txt -X POST -H 'Content-Type: application/json' \
  -d "{\"code\":\"$CODE\"}" "$HOST/api/invite/redeem" | jq
# expect: { "ok": true }
```

**Check** — `beta-host-cookies.txt` contains a `beta_access` entry.

```bash
# The session now opens the data endpoints
curl -s -b beta-host-cookies.txt "$HOST/api/cards" | jq '.cards | length'
# expect: 36
```

### A.12.3 A calculation completes, and matches local

```bash
CARD=$(curl -s -b beta-host-cookies.txt "$HOST/api/cards" | jq -r '.cards[0].id')

curl -s -b beta-host-cookies.txt -X POST -H 'Content-Type: application/json' \
  -d "{\"cardId\":\"$CARD\",\"amountRupees\":2500,\"merchantName\":\"Test Restaurant\",\"merchantCategory\":\"dining\",\"transactionDate\":\"2026-10-14\"}" \
  "$HOST/api/calculate" | tee /tmp/host-calc.json | jq '{resolved: .result.resolved, rewardValue: .result.grossReturnCents, rules: (.result.trace.entries | length)}'
```

**Check** — `resolved: true`, a non-null reward value, and a trace with entries. Then run the **identical** request against localhost (§6.2) and compare `grossReturnCents`. They must match. A mismatch means the hosted seed differs from local — re-check A.11 step 3.

### A.12.4 A contextual report lands in the steward queue

```bash
curl -s -b beta-host-cookies.txt -X POST -H 'Content-Type: application/json' \
  -d "{\"cardId\":\"$CARD\",\"description\":\"Host acceptance check\",\"sourceUrl\":\"https://example.com/terms\"}" \
  "$HOST/api/reports" | tee /tmp/host-report.json | jq
# expect: 201 with { reportId, dataLeadId, createdAt }

REPORT=$(jq -r '.reportId' /tmp/host-report.json)

# It created a Data Lead, which is what the steward queue lists
curl -s -H "Authorization: Bearer $ADMIN_TOKEN" "$HOST/api/admin/leads" | jq '.leads | length'

# And the report detail is readable by its id
curl -s -H "Authorization: Bearer $ADMIN_TOKEN" "$HOST/api/admin/reports/$REPORT" | jq '.report.description'
```

**Note on the routes.** There is **no** `GET /api/admin/reports` list endpoint — the steward queue reads `/api/admin/leads` (pending Data Leads), and `/api/admin/reports/[id]` takes a report UUID. Submitting a report creates both a `contextual_reports` row and a `data_leads` row, so the lead is what appears in the queue.

### A.12.5 Revocation evicts a live session

```bash
# Revoke the code that is currently in use
curl -s -X POST -H "Authorization: Bearer $ADMIN_TOKEN" \
  "$HOST/api/admin/invites/$CODE/revoke" | jq
# expect: { "ok": true }   (404 if the code was already revoked)

# The live session must now be refused — this is the whole access model
curl -s -b beta-host-cookies.txt -o /dev/null -w 'cards (revoked) %{http_code}\n' \
  "$HOST/api/cards"
# expect: 401

curl -s -b beta-host-cookies.txt -o /dev/null -w 'root (revoked) %{http_code} -> %{redirect_url}\n' \
  "$HOST/"
# expect: 307 -> $HOST/invite?revoked=1
```

**Check** — if the revoked session still returns 200, ticket 02's fix is presence-only. Go back.

### A.12.6 Direct API calls, not the UI

Every check above is a raw HTTP call. That is deliberate — a check that goes through the browser can pass on the redirect while the endpoint stays open. Keep them raw.

### A.12.7 Browser pass

Open `$HOST` in a browser. Confirm the invite page renders at desktop and mobile widths, and that redeeming a fresh code lands you on the calculator. This is the only step that wants a browser.

### A.12.8 Done means

- Anonymous access refused on every data endpoint; health open.
- Redeem → session → calculate → report all work on the host.
- The hosted calculation matches the local one.
- Revocation evicts a live session.
- Desktop and mobile render correctly.
- **The result is written down:** the URL, the date, what was exercised, what did not behave as expected.

---

## A.13 Ticket 05 — Minimum production safety

**Blocked by:** 03. **Roughly 1 day.** Mixed: `/wizard` for the provider steps, `/implement` for the notice.

### A.13.1 Backup, and a rehearsal

A backup that has never been restored is not a backup.

```bash
# Take one (adjust to your provider's dump tooling)
export DATABASE_URL='<hosted>'
pg_dump "$DATABASE_URL" --no-owner --no-acl -f /tmp/ccplatform-$(date +%F).sql
ls -lh /tmp/ccplatform-*.sql      # expect a non-trivial size
```

Then **restore it into a scratch database** and prove the data is there:

```bash
export SCRATCH_URL='<a throwaway database, NOT production>'
psql "$SCRATCH_URL" -f /tmp/ccplatform-$(date +%F).sql
psql "$SCRATCH_URL" -c 'SELECT count(*) FROM cards;'                 # expect 40
psql "$SCRATCH_URL" -c "SELECT count(*) FROM rule_versions WHERE retracted_at IS NULL;"
psql "$SCRATCH_URL" -c 'SELECT count(*) FROM invite_codes;'
```

**Check** — the counts match production. Record the restore duration; that is your recovery time.

### A.13.2 Recurring backup and an uptime monitor

- Schedule the dump on a stated cadence, with a stated retention window and destination.
- Point an external monitor at `$HOST/api/health`; it must alert on failure. A health probe nobody watches does not count.

```bash
# What the monitor will poll — expect 200 and db: connected
curl -s "$HOST/api/health" | jq
```

### A.13.3 The invite notice, and a truthful verified-date

Two content changes:

**The notice.** Issue 40 decided a plain-language notice goes **verbatim** on `/invite` and in the invite email: what is recorded, what is not, the cookie, the retention sentence, "not financial advice / not an issuer complaint channel", and the stop promise (revoke + delete `beta_events` within 7 days, reports stay unattributed). It cites no legislation. It is **not on the page today** — `app/src/app/invite/page.tsx` carries only a short beta-access blurb.

**The verified date.** `SEED_VERIFIED_AT` in `app/src/catalog/verified-card-set.ts` is hard-coded to `2025-01-01` and rendered verbatim in the UI (`home-client.tsx`, `verified {formatDate(meta.sourceDate)}`). The app therefore claims facts were verified in January 2025. Either refresh it to the date the set was actually re-checked, or state the real date. **Do not tick this by changing only the constant** — confirm the seed script writes the new date through to the rows.

**Scope warning:** the retention and deletion promises must match what the system actually does. If the notice promises deletion within a window, the mechanism to honour it must exist — or soften the promise to what is true.

### A.13.4 A written restore procedure

One page: how to bring service back after a failure. Walk it once. It is the difference between a rehearsal and a plan.

### A.13.5 Done means

- Backup taken **and** restore rehearsed, with counts verified and duration recorded.
- Recurring backup scheduled with a stated retention and destination.
- Uptime monitor live on `/api/health`, alerting on failure.
- The notice verbatim on `/invite` and in the invite email.
- The verified-date shown to users is truthful, and the seed writes it through.
- A written restore procedure, walked once.

---

## A.14 Ticket 06 — Reconcile the tracker with reality

**Blocked by:** nothing. **Roughly 1 h.** No product code. Good first session — it clears the traps before they mislead another one.

Four edits, each with a `Check`.

**1. The two phantom tickets.** `03-payment-strategy-composition-layer.md` and `04-payment-strategy-trace-header.md` were built in `f148c5a` but left `ready-for-agent`. **Already corrected on 2026-10-13** — verify rather than redo:

```bash
grep -m1 'Status:' .scratch/payment-strategy/issues/03-*.md .scratch/payment-strategy/issues/04-*.md
# expect: done for both
```

**2. The Phase-6 gate override.** Five commits built Phase-6 tickets against the runbook's explicit *"do not `/implement` until issue 43 records a pass."* The override existed only outside the repo. **Already recorded in `.scratch/payment-strategy/map.md`** on 2026-10-13 — verify:

```bash
grep -n "Gate override" .scratch/payment-strategy/map.md
# expect a hit
```

**3. The hosting ADR.** Vercel + managed Postgres supersedes Issue 39's single-VPS decision. This one is **not yet written**. Raise it as an ADR in `docs/adr/` (next free number is `0007`), stating what the earlier decision assumed and why the change is warranted. Follow the existing ADRs' shape — frontmatter `status: accepted`, then the decision and its consequences.

**Check:**

```bash
ls docs/adr/ | tail -3
grep -l "Vercel" docs/adr/*.md
```

**4. Nothing is deleted.** The paused Closed Beta and demo maps keep their history intact so either can be resumed.

```bash
ls .scratch/mvp/map.md .scratch/demo/map.md .scratch/vercel-mvp/map.md
# expect all three present
```

### A.14.1 Done means

- The two phantom tickets read `done`, with their delivering commit recorded.
- The Phase-6 gate override is written in the payment-strategy map.
- An ADR records Vercel + managed Postgres, superseding the VPS decision.
- The record follows the repo's own rule: a gate redraw or plan change is recorded as an ADR or a plan amendment, never silently.
- All three maps still exist.

---

## A.15 Troubleshooting this effort

| Symptom | Cause | Fix |
|---|---|---|
| `npm run lint` prints `ESLint output (JSON parse failed…)` | output wrapper mangles ESLint | run `./node_modules/.bin/eslint` and read the exit code (A.8) |
| `npm ci` fails with `ERESOLVE` | ESLint was bumped to 10 | pin back to `^9.39.5`; `eslint-plugin-jsx-a11y` has no v10-compatible release |
| `DATABASE_URL is not set` from a script | scripts do not read `.env` | `export DATABASE_URL=...` in that terminal |
| Hosted `/api/health` returns `503 db: disconnected` | wrong, unpooled, or unreachable connection string | use the provider's **pooled** endpoint; check Vercel env vars |
| Intermittent connection errors on the host under light load | a `pg.Pool` per serverless instance | use the pooled endpoint, or a pooler |
| `seed --approve` publishes 40, not 36 | evidence domain check regressed | re-run `npm test`; inspect `app/src/catalog/evidence.ts` |
| A revoked code still returns 200 | gating checks cookie *presence*, not validity | validate against the database on the API path too (A.10.2) |
| Migration appears to succeed but tables are missing | ran against localhost, not the hosted URL | re-export `DATABASE_URL` and re-run; confirm with `psql "$DATABASE_URL" -c '\dt'` |
| Next.js picks port 3001 locally | 3000 in use | substitute the real port in every curl |
