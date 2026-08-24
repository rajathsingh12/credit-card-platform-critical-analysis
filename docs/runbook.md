# Launch & Verification Runbook

How to bring the platform up on Colima + Docker and prove, step by step, what has actually been built.

Every stage has **Run** (what you type) and **Check** (what proves it worked). If a Check fails, stop and fix it before moving on — later stages assume earlier ones passed.

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
| 5 | inspect the outcome card | Shows `Resolved` / `Unresolved` state, Net Return, and an **Evidence** badge |
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
