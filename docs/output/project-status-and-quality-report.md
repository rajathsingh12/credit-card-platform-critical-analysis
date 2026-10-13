# Project Status, Code Quality & Remaining Work

**Report date:** 2026-10-13
**Repository:** `credit-card-platform-critical-analysis`
**Branch:** `main` @ `6515866` (clean tree, in sync with `origin/main`)
**Scope:** read-only assessment. No source file was modified to produce this report.
**Question answered:** where the project stands, whether the code is actually good, whether the work followed the plan, and exactly how much is left before an invite-only production MVP can be hosted on Vercel.

---

## 1. Executive summary

The platform is a **working, well-tested, well-architected application** that is **not currently deployable**. The product surface for the MVP is essentially complete; the gap to a hosted invite-only production MVP is **deployment plumbing and access-control hardening**, not product features.

Three findings dominate everything else:

| # | Finding | Severity | Evidence |
|---|---|---|---|
| 1 | **`npm run build` fails.** A dead type import makes ESLint fail, and `next build` runs ESLint. The app cannot be built at all right now. | **Blocker** | `app/src/engine/periodic-cap.ts:1` imports `CapPeriod` unused; build exits **1** |
| 2 | **CI has never passed — 0 of 8 runs.** It dies at `npm install` on an ESLint peer-dependency conflict, so typecheck/test/build/lint have *never* run in CI. | **Blocker** | `gh run list` → 8/8 `[FAIL]`; `ERESOLVE` on `eslint@10.8.1` vs `eslint-plugin-jsx-a11y` |
| 3 | **The invite gate protects the UI, not the API.** Middleware matches only `/` and `/api/admin/*`. Every JSON endpoint — including `/api/calculate`, `/api/cards`, `/api/reports` — is reachable by anyone, unauthenticated. | **Security** | `app/src/middleware.ts:24` matcher; `/api/calculate` reads `BETA_COOKIE` only to *tag telemetry*, never to gate |

Despite that, the underlying engineering is strong: **370 tests pass**, the layering is genuinely clean, and the domain/evidence discipline is unusually rigorous. This is a codebase with **build and ops debt**, not a codebase with **design debt**.

**Headline numbers**

| Metric | Value |
|---|---|
| Commits / span | 50 / 2026-08-18 → 2026-09-30 |
| Source (non-test) LOC | 5,148 |
| Test LOC | 4,340 (ratio **0.84 : 1**) |
| Tests | **370 passing**, 27 files, 1.8s |
| API routes | 17 (10 admin, 7 public) |
| Migrations | 7 |
| ADRs | 6 |
| Tickets terminal | 51 done/resolved/completed |
| Tickets open | 15 (10 open, 3 ready-for-agent, 2 needs-info) |
| Gates green today | typecheck ✅ · tests ✅ · **lint ❌** · **build ❌** · CI ❌ |

---

## 2. Where the project is right now

### 2.1 Timeline reconstructed from git

| Period | Commits | What happened |
|---|---|---|
| 2026-08-18 → 08-22 | 35 | Phases 1–3 built: schema, engine, publication gate, seed, transaction form, outcome display, invite gate, contextual reports, telemetry, catalog export, change feed, admin console. Then 20 code-review tickets (16–31, 34, 35) closing duplication and contract gaps. |
| 2026-08-24 | 1 | Dockerfile, compose, entrypoint, `seed-invites`, README, runbook. First end-to-end QA pass. |
| 2026-09-12 → 09-13 | 4 | Phase-4 gate redrawn (ADR 0004, Issue 38); `withTransaction` ROLLBACK guard (Issue 45); the "Bars" calculator UI shipped (Issue 44). |
| 2026-09-25 → 09-29 | 4 | Destination redrawn: Closed Beta map **paused**, stakeholder demo map opened. Invite + admin UI restyled onto the shared design system. Reward Value ranking (ADR 0005, Issue 06). |
| 2026-09-30 | 6 | **Phase 6 (Payment Strategy) built.** ADR 0006 + runbook, then tickets 01 → 06 in five commits. |

### 2.2 The previous session (reconstructed)

The last work session covered **Payment Strategy Phase 6**. Per the persisted project memory and confirmed against git:

- **Ticket 01** (route-fact Reward Rule type) — done, `77089b7`. `app/src/strategy/route-fact.ts`, 27 tests.
- **Ticket 02** (periodic-cap modelling, builds out Issue 33) — done, `9059de9`. `app/src/engine/periodic-cap.ts`, `PeriodicCapConfig`/`PeriodicUsageEntry`/`CapPeriod` added to `engine/types.ts`, engine integration, 17 tests.
- Memory recorded next step as **T3 + T5 in parallel, then T4 + T6**.

Git shows all four landed afterwards:

- **Tickets 03 + 04** (composition layer + trace header) — `f148c5a`
- **Ticket 05** (curated verified strategy seed) — `5ff2175`
- **Ticket 06** (output / annotation contract) — `6515866`

So **Phase 6 is 6 of 7 tickets built.** Only ticket 07 (catalog / change-feed representation for routes) remains.

> ⚠️ **Important process finding.** The runbook §1 states, in bold, *"Until issue 43 records a `pass`: do not `/implement` any Payment Strategy ticket."* Issue 43 is still `open`, and the runbook's own preamble records *"Right now the gate is **not passed**."* The prior session proceeded anyway under a user override. That override is **not written down anywhere in the repo** — `grep` for a gate-override record across `.scratch/` and `docs/` returns nothing. Every Phase-6 commit therefore contradicts a written, explicit guardrail with no recorded justification.

### 2.3 What is built, by phase

| Phase | Status | Notes |
|---|---|---|
| **0 — Readiness & validation** | ✅ Done | 36-card verified set + 4 withheld; evidence standard; golden dataset; steward = antman; pilots ruled out of MVP scope |
| **1 — Versioned data & engine** | ✅ Done | 7 migrations, versioned rule versions, verification records, publication gate, deterministic engine, ADR 0002/0003 enforced in code |
| **2 — Zero-login consumer workflow** | ✅ Done | Transaction form, side-by-side outcomes, Calculation Trace, Evidence Status, invite gate, Unresolved states |
| **3 — Review & correction ops** | ✅ Done | Data Leads, approve/reject/verify, retraction, Correction History, Contextual Reports, admin console |
| **4 — Closed Beta** | ⏸️ **Not started** | 8 open tickets (42, 43, 46–52). Map explicitly *paused*, not cancelled |
| **5 — Managed B2B pilot** | ➖ Out of MVP scope | Catalog export + change feed built but **dormant** |
| **6 — First Expansion (Payment Strategy)** | 🟡 6/7 built | Wired end-to-end, but **no route can currently surface in the UI** (see §4.4) |

### 2.4 The two live efforts

The tracker holds two maps, and they point in different directions:

- **`.scratch/mvp/` — Closed Beta.** Paused 2026-09-25. Destination: run the beta with the friends/network cohort, then record a Phase-4 gate verdict. 8 tickets open, all ops/hosting/compliance.
- **`.scratch/demo/` — Stakeholder look-and-feel demo.** Opened 2026-09-25. Destination: antman clicks through the app on localhost and validates look & feel. **Ticket 05 is the only open ticket** — the validation session itself.

Plus **`.scratch/payment-strategy/`** (Phase 6), which is the most recently active.

**These three are not reconciled.** Phase 6 was built while the Phase-4 gate that was supposed to precede it is unpassed; the demo map declares hosting to Vercel *"out of scope"* while the beta map assumed a VPS. The Vercel question you are asking now is a **fourth direction** that no map currently owns.

---

## 3. Verification — what I actually ran

I re-ran every gate rather than trusting the runbook's claim that all four are green.

| Gate | Command | Result |
|---|---|---|
| Typecheck | `npm run typecheck` | ✅ **PASS** — clean |
| Tests | `npm test` | ✅ **PASS** — 370 tests, 27 files, 1.80s |
| Lint | `npm run lint` | ❌ **FAIL** — 1 error |
| Build | `npm run build` | ❌ **FAIL** — exit code **1** |
| CI | `gh run list` | ❌ **8 of 8 runs failed** |

**The lint error**

```
app/src/engine/periodic-cap.ts
  1:15  error  'CapPeriod' is defined but never used.  @typescript-eslint/no-unused-vars
```

The import line is unchanged since it was introduced in `9059de9` (ticket 02). `next build` runs ESLint, so **the production build has been broken since ticket 02** — the last two Phase-6 commits (05, 06) were made on top of a red build.

**The CI failure**

```
npm error ERESOLVE could not resolve
npm error While resolving: eslint-plugin-jsx-a11y@6.10.2
npm error Found: eslint@10.8.1
npm error Could not resolve dependency:
npm error peer eslint@"^3 || ^4 || ^5 || ^6 || ^7 || ^8 || ^9" from eslint-plugin-jsx-a11y@6.10.2
```

`package.json` pins `eslint: ^10.8.1`, but `eslint-plugin-jsx-a11y@6.10.2` only accepts ESLint ≤ 9. The `Dockerfile` works around this with `npm ci --legacy-peer-deps`; the CI workflow does **not**. So CI has been structurally incapable of passing, and the badges are meaningless.

> **Caveat on the runbook.** `docs/runbook-sept-30.md` §2.7 instructs *"Run all four gates from `app/`"*, and the per-session checklist repeats it. Tickets 03–06 were committed against that instruction. Lint and build were not green. I did not find any written note acknowledging this.

---

## 4. Code quality assessment

### 4.1 Scores

| Dimension | Score | Basis |
|---|---|---|
| **Architecture** | **8.5 / 10** | Clean, enforced layering; pure seams; ADR-backed decisions |
| **Code quality** | **8.0 / 10** | 370 tests, zero code smells, consistent idiom; docked for a red build + CI |
| **Plan conformance** | **8.5 / 10** | Phases 0–3 complete, deviations ADR-recorded; docked for the unrecorded gate override and one stale seed date |
| **Verification integrity** | **6.0 / 10** | Tests are excellent; the surrounding gates have been red for weeks without being caught |
| **Production readiness** | **3.0 / 10** | Not deployable: broken build, no host, ungated APIs, no backup/migration path |
| **Overall** | **7.3 / 10** | Excellent engineering, undeployed product |

### 4.2 Architecture — genuinely strong

The layering is the best thing about this codebase, and it is **enforced rather than aspirational**:

```
engine/calculate.ts     pure, single-card, no DB       ← never modified by Phase 6
  ↑
strategy/compose.ts     pure, DB-free composition      ← the one new seam
  ↑
api/calculate/route.ts  all Postgres access lives here
  ↑
app/home-client.tsx     client-side ranking, unchanged
```

Specific strengths:

- **The engine boundary held.** ADR 0006 said *"`calculate.ts` and `CalcResult` are unchanged"*, and that is literally true — `git log` on `calculate.ts` shows Phase 6 touched it only in ticket 02 (periodic caps), which was an explicitly-sanctioned predecessor. Composition sits strictly above.
- **Pure seams make testing cheap.** `compose()` takes already-fetched data as arguments, mirroring how `calculate()` receives rules. This is why the suite is DB-free and runs in 1.8s.
- **The evidence model is a real spine, not decoration.** `validateEvidence()` rejects `officially-documented` evidence that does not cite the issuer's own domain, and rejects `community-reported` evidence that *does*. That second rule is a subtle, correct defence against laundering a community claim as official.
- **Domain language is disciplined.** `CONTEXT.md` lists explicit `_Avoid_` terms, and the code respects them — no "recommendation", no "effective cost", no "best card" anywhere in the source. Rare and valuable.
- **Zero code smells.** Across `src/` and `scripts/`: **no** `TODO`, `FIXME`, `HACK`, `@ts-ignore`, `@ts-expect-error`, `as any`, `.only(`, `.skip(`, or stray `console.log`. I checked; there are none.

### 4.3 Architecture — the deductions

| Issue | Location | Why it matters |
|---|---|---|
| **Stringly-typed header contract** | `compose.ts:180` — `assumptions: [JSON.stringify(facts)]` | The composition header packs a structured object into a JSON string inside a field typed `string[]`. Ticket 04's whole point is an auditable header; any consumer must `JSON.parse` a magic string. This will bite the first time someone reads the trace programmatically. |
| **Type-level lie to reuse the engine** | `compose.ts:127` — `pricedRule()` rewrites `ruleType: 'direct'` → `'variable'` | A direct rule is relabelled variable so the engine will attach a cash value. It works, and the comment explains why, but it means the `ruleType` field no longer describes reality at that call site. |
| **Two sources of schema truth** | `src/db/schema.ts` (Drizzle) + `migrations/*.sql` (hand-written) | `drizzle.config.ts` admits these are "complementary". Nothing verifies they agree; drift would be silent. |
| **Unused field** | `types.ts` — `merchantName` on `TransactionContext` | Accepted, validated, threaded through, never read by the engine. |
| **Timezone accepted but ignored** | `PeriodicCapConfig.timezone` | Acknowledged in JSDoc; `periodKey()` uses calendar boundaries only. Correct for India (no DST), latent if the launch market ever changes. |

None of these are defects that will produce a wrong number today. They are the kind of thing that costs an hour eighteen months from now.

### 4.4 The Phase-6 capability is wired but user-invisible

This is worth stating plainly because it is easy to miss.

The seeded routes (`app/src/strategy/strategy-seed.ts`) are all `walletExclusion()` — `pointsPerDollar: 0`, `voucherFeeCents: 0`. Their composed Reward Value is therefore exactly **0**. `applicableStrategies()` only keeps a resolved route when it **beats** the direct outcome, so:

- A zero-yield route never beats a direct outcome > 0 → filtered out.
- The test suite **asserts this behaviour deliberately** (`applicable.test.ts:92` — *"prices the seeded exclusion route at zero, so it does not beat the direct"*).

Meanwhile every positive-yield route (portal multipliers) is correctly held as a **Data Lead** because the research found the multipliers undocumented or secondary. So:

> **Phase 6 ships zero user-visible Payment Strategies.** The plumbing is complete and correct; the data cannot clear the evidence bar. This is the *intended* trust posture per ADR 0006 (*"Expect the initial curated set to be small and many routes to resolve Unresolved. This is the intended trust posture, not a shortfall."*) — but it means the capability's value is currently unproven.

### 4.5 Test suite assessment

| Aspect | Assessment |
|---|---|
| Count / speed | 370 tests, 27 files, 1.8s — excellent |
| Test : source ratio | 0.84 : 1 — high for a project this size |
| DB-free invariant | **Held.** No test imports the DB client; DB checks live in `app/scripts/` |
| Behaviour vs structure | Tests assert external behaviour (trace contents, resolved/unresolved status, netting) rather than internals — the right level |
| Golden dataset | `engine/golden-dataset.test.ts` — 22 regression tests over caps, exclusions, fees, effective dates |
| Gaps | No test covers the `SEED_VERIFIED_AT` display path; no test asserts the API routes are *gated* (because they aren't) |

---

## 5. Did the work follow the plan?

Mostly yes — better than most projects. Here is the honest ledger.

### 5.1 Followed the plan ✅

| Plan commitment | Status | Evidence |
|---|---|---|
| Phase 0 exit criteria (ownership, card set, evidence standard, golden dataset, cohort) | ✅ | 36-card set, ADR 0002/0003, `golden-dataset.test.ts`, steward = antman (Issue 02) |
| Phase 1: versioned records, never overwrite history, deterministic engine | ✅ | 7 migrations; `rule_versions` + `retracted_at`; engine is pure |
| Phase 2: zero-login, no accounts, invite-gated | ✅ | No user table exists; invite codes only |
| Phase 3: steward workflows, correction without destroying history | ✅ | `publish.ts`, `retract.ts`, `correction_history`, admin console |
| Non-goals respected | ✅ | No billing, no affiliate, no bank linking, no LLM-authored facts, no public API commitment |
| ADR 0005: rank by Reward Value, annual fee separate | ✅ | `grossReturnCents` + `annualFeeCents`; `effective cost` appears nowhere in `src/` |
| ADR 0006: engine untouched, compose above | ✅ | `calculate.ts` unchanged by Phase 6 except sanctioned ticket 02 |
| ADR 0006: curated routes, not enumeration | ✅ | `strategy-seed.ts` is a fixed list |
| ADR 0006: unverified → Unresolved, never a number | ✅ | `compose.ts` returns `UnresolvedStrategy`; `strategyAnnotation` prints reason, no number |
| Repo invariant: vitest stays DB-free | ✅ | Verified across all 27 test files |

### 5.2 Deviated ❌

| Deviation | Severity | Detail |
|---|---|---|
| **Gate override never recorded** | **High** | Runbook §1 forbids `/implement` on any Phase-6 ticket until issue 43 records a `pass`. Issue 43 is `open`. Five Phase-6 commits exist. The override lives only in an out-of-repo memory file — nothing in `.scratch/` or `docs/` records it. `docs/agents/domain.md` requires a gate redraw to be "recorded as an ADR or a plan amendment, never silently." |
| **Build shipped broken for two commits** | **High** | Ticket 02 introduced the lint error; tickets 05 and 06 were committed on top. The runbook's own per-session checklist says to run all four gates before claiming done. |
| **`SEED_VERIFIED_AT` is stale** | **Medium** | Still `2025-01-01`. Issue 41 decided the pre-beta re-check date should be *"dated into `SEED_VERIFIED_AT` so the UI's existing 'verified \<date\>' is true"*. The UI renders that string verbatim (`home-client.tsx:266`), so the app currently claims facts were verified in January 2025. Issue 48 is open. |
| **Four different destinations, unreconciled** | **Medium** | Closed Beta (VPS, paused) · stakeholder demo (localhost, "hosting out of scope") · Phase 6 (built despite its gate) · Vercel MVP (this report). No map owns the Vercel path. |
| **`npm install` locally needs `--legacy-peer-deps`** | **Low** | The Dockerfile works around it; the local dev path and CI do not. |

### 5.3 Verdict

The *engineering* followed the plan closely — the phase structure, the non-goals, the ADR constraints, and the vocabulary are all respected in code. The *process discipline* around the plan is where it slipped: a guardrail was overridden without a written record, and a build-breaking gate was not run before two commits were declared done.

---

## 6. Gap analysis — what stands between here and a hosted invite-only MVP

### 6.1 Blockers (cannot ship without these)

| # | Gap | Where | Effort |
|---|---|---|---|
| **B1** | Fix the lint error so the build passes | `app/src/engine/periodic-cap.ts:1` — drop the unused `CapPeriod` import | **5 min** |
| **B2** | Fix the CI dependency conflict | `package.json` — either downgrade `eslint` to `^9` or bump `eslint-plugin-jsx-a11y` to a v10-compatible release; then CI runs green for the first time | **30 min** |
| **B3** | **Gate the API routes** | `app/src/middleware.ts:24` — matcher is `['/', '/api/admin/:path*']`. Extend to protect `/api/calculate`, `/api/cards`, `/api/reports`, `/api/telemetry`, `/api/correction-history` (leave `/api/health` open for uptime probes). `/api/calculate` currently reads the cookie only for telemetry, never to authorise. | **1–2 h** |
| **B4** | **Hosted Postgres with migrations applied** | `src/db/client.ts` opens a `pg.Pool` at module load and throws if `DATABASE_URL` is unset. Needs a managed Postgres (Neon/Supabase/Vercel Postgres), `DATABASE_URL` as a Vercel env var, and a way to run `migrate` + `seed` + `seed:invites` against it. | **3–5 h** |
| **B5** | **Seed the hosted database** | `docker-entrypoint.sh` runs migrate/seed/approve/seed-invites on container boot — that path does not exist on Vercel. Needs a one-off manual run or a protected admin endpoint. | **2–3 h** |
| **B6** | **Set production secrets** | `ADMIN_TOKEN` and `BETA_INVITE_CODES` must be set in Vercel. **Note:** `BETA_INVITE_CODES` is only read by `scripts/seed-invites.ts`, never at runtime — codes live in the `invite_codes` table. | **30 min** |
| **B7** | **Verify the invite flow end-to-end on the host** | Cookie is `httpOnly` + `sameSite: 'strict'`, but **not `secure: true`** — Issue 39 decided it should be `secure: true` in the beta. Must be set before serving over HTTPS. | **1 h** |
| **B8** | **Decide the hosting story explicitly** | No `vercel.json` exists. The demo map says hosting is out of scope; the beta map assumed a VPS. Vercel was never a recorded decision. | **decision** |

### 6.2 Security findings

| Finding | Severity | Detail |
|---|---|---|
| **Public JSON API** | **High** | Any unauthenticated caller can `POST /api/calculate` and read reward outcomes, or `GET /api/cards` for the full verified card list. The invite gate is a UI redirect, not an access control. |
| **`/admin` page shell is unprotected** | **Medium** | Middleware matches `/` and `/api/admin/:path*` — **not** `/admin`. The page renders `AdminConsole`, which asks for a token client-side. The token is held in memory only (`admin-console.tsx:103` — *"not stored, logged, or embedded"*) and every data route behind it is bearer-gated, so **no data leaks**. But the console shell is publicly served. |
| **Cookie not `secure`** | **Medium** | Over HTTPS the invite cookie should be `secure: true` (decided in Issue 39, not yet applied). |
| **No rate limiting** | **Medium** | `grep` for `rateLimit\|429\|throttle` across `src/` returns **nothing**. `/api/calculate` and `/api/reports` are unmetered — trivial to abuse once public. |
| **`/api/reports` accepts unauthenticated writes** | **Medium** | It inserts into `data_leads` + `contextual_reports` with no invite check. Once public, anyone can write rows into your database. |
| **Invite cookie carries the raw code** | **Low** | The cookie value *is* the invite code. `sameSite: strict` + `httpOnly` mitigate it; re-validation against the DB on every `/` load is good practice. |

### 6.3 Vercel-specific gaps

| Gap | Detail |
|---|---|
| **No `vercel.json`** | None exists at root or in `app/`. Vercel may auto-detect Next.js, but the project lives in `app/` — a root-directory setting or `vercel.json` is needed. |
| **`next.config.ts` has no `output: 'standalone'`** | Vercel handles Next natively, so this is likely unnecessary — but `outputFileTracingRoot: __dirname` is set for a *pnpm* workspace root that does not exist here. Worth re-checking. |
| **Connection pooling** | A `pg.Pool` per serverless instance will exhaust a Postgres connection limit under any real traffic. Needs a pooler (Neon pooled endpoint, Supabase Supavisor, or PgBouncer). |
| **No migrations in the deploy path** | Vercel has no equivalent of `docker-entrypoint.sh`. Migrations must be run manually or via a build step. |
| **`middleware.ts` uses `crypto`** | `beta/invite.ts` imports `crypto`, and the build warns: *"A Node.js module is loaded ('crypto' at line 1) which is not supported in the Edge Runtime."* Middleware runs on Edge by default. It currently works because only `BETA_COOKIE` is used, but this is a latent failure. |
| **Cold starts + `checkInviteCode`** | Every `/` load does a DB round trip. Acceptable at beta scale; worth knowing. |

### 6.4 Product gaps

| Gap | Detail |
|---|---|
| **Phase 6 has no user-visible effect** | §4.4 — all seeded routes yield zero and are filtered out. |
| **Phase 6 ticket 07 unbuilt** | `catalog-export.ts` and `change-feed.ts` have **zero** route-fact handling (verified by grep). Phase 5 is out of MVP scope, so this is genuinely deferrable. |
| **Stale verified date shown to users** | §5.2 — `2025-01-01`. |
| **The demo validation never happened** | `.scratch/demo/issues/05` is open. No human has signed off the look & feel. |
| **Beta operations entirely unbuilt** | Tickets 46–52: gate query, invite-code generation, steward routine, host provisioning, backups, cutover, compliance notice. |
| **No backup / restore path** | Issue 50 open. For a hosted DB this is a real risk. |
| **Compliance notice not written** | Issue 52 open. Issue 40 decided a plain-language notice goes verbatim on `/invite` and in the invite email. **It is not there today** — `invite/page.tsx` shows only a short beta-access blurb. |

---

## 7. How much work is actually pending?

### 7.1 Counted from the tracker

| Bucket | Tickets | Nature |
|---|---|---|
| **Phase 6 build (payment-strategy)** | 1 open (07) + 6 done | Ticket 07 is additive, Phase-5-facing, **deferrable** |
| **Stakeholder demo** | 1 open (05) | Human validation session — not engineering |
| **Closed Beta go-live** | 10 open (42, 43, 46–52) + 2 needs-info (32, 33) | Ops, hosting, compliance |
| **New work this report identifies** | 8 blockers (B1–B8) | None of these exist as tickets |

**Total open tickets: 15.** But ticket count badly understates the Vercel path, because **no ticket owns it**.

### 7.2 Two different finish lines

The honest answer depends on which destination you mean — and these have materially different costs.

#### Finish line A — Invite-only MVP on Vercel (what you asked for)

You asked specifically for: invite codes → redeem → authenticate → use the platform. **That flow already exists and works.** What is missing is deployment and hardening.

| Workstream | Items | Effort |
|---|---|---|
| **Unblock the build** | B1, B2 | **~0.5 day** |
| **Access control** | B3, B7 (+ `/admin` shell, rate limiting on write paths) | **~1.5 days** |
| **Deploy to Vercel** | B4, B5, B6, B8 — managed Postgres, pooling, migrations, secrets, `vercel.json` | **~2 days** |
| **Verify on the host** | End-to-end: invite → cookie → calculate → report; confirm revocation evicts a live session | **~0.5 day** |
| **Minimum ops safety** | Backup/restore rehearsal, `/api/health` uptime probe, compliance notice on `/invite` | **~1 day** |
| | **Total** | **≈ 5.5 working days** |

**Explicitly excluded from Finish line A** (deferrable without blocking a hosted invite-only MVP): Phase 6 ticket 07, the periodic-cap timezone work, Phase 5 catalog/change-feed for routes, and the beta's 30-day measurement machinery (tickets 42/43).

#### Finish line B — Closed Beta actually run (what the paused map describes)

| Workstream | Items | Effort |
|---|---|---|
| Finish line A | B1–B8 | ~5.5 days |
| **Beta ops** | Tickets 46, 47, 48 — gate query by invite code, generate 10 codes, steward routine + fresh `SEED_VERIFIED_AT` | **~2 days** |
| **Host & operations** | Tickets 49, 50, 51 — provision, backups, cutover (per ADR 0004: one VPS, caddy, `pg_dump` daily) | **~2 days** |
| **Compliance** | Ticket 52 — beta notice verbatim on `/invite` + invite email | **~0.5 day** |
| **Run the beta** | Ticket 42 — 30-day window | **30 days elapsed** |
| **Verdict** | Ticket 43 — pass / fail / extend against ADR 0004 criteria | **~0.5 day** |
| | **Total engineering** | **≈ 10.5 working days + 30 days elapsed** |

#### Finish line C — The full remaining plan

Finish line B, plus Phase 6 ticket 07, plus graduating Issues 32/33 from `needs-info`, plus Phase 5 (deliberately dormant). **Not recommended now** — Phase 5 is out of MVP scope by the Phase-0 gate decision.

### 7.3 Recommendation

**Target Finish line A.** It is roughly **one engineering week** to a genuinely hosted, invite-gated, production MVP on Vercel — and it is the only finish line that matches what you described wanting.

Before starting, resolve two things:

1. **Record the hosting decision.** No map owns "Vercel." Either write an ADR amending Issue 39's VPS decision, or state the override explicitly. The repo's own rule (`docs/agents/domain.md`) is that a gate redraw is recorded, never silent — and that rule was already broken once this project.
2. **Retroactively record the Phase-6 gate override.** Five commits currently contradict a written guardrail with no justification on file. One paragraph in `.scratch/payment-strategy/map.md` closes it.

### 7.4 Suggested order

```
Day 1   B1 + B2   → build green, CI green for the first time
Day 1-2 B3 + B7   → API gated, /admin shell gated, cookie secure
Day 2-4 B4-B6     → managed Postgres, pooling, migrations run, secrets set, vercel.json
Day 4-5 Verify    → invite → cookie → calculate → report on the host; revocation evicts a session
Day 5   Ops       → backup rehearsal, uptime probe, compliance notice on /invite
```

Note that **B1 is five minutes of work** and unblocks the build, the Docker image, and CI at once. Nothing else in this report is worth starting before it.

---

## 8. Appendix — raw evidence

| Check | Command | Result |
|---|---|---|
| Lint | `npm run lint` | 1 error: `'CapPeriod' is defined but never used` at `periodic-cap.ts:1:15` |
| Build | `npm run build` | Exit **1**; `✓ Compiled successfully in 3.9s` then `Failed to compile` on the ESLint error |
| Tests | `npm test` | 27 files / 370 tests passed, 1.80s |
| Typecheck | `npm run typecheck` | Clean |
| CI | `gh run list --limit 8` | 8 × `[FAIL]`; latest failure at `npm install` (ERESOLVE) |
| Tree | `git status --short` | Clean; `main` in sync with `origin/main` (0 ahead / 0 behind) |
| Middleware matcher | `app/src/middleware.ts:24` | `['/', '/api/admin/:path*']` |
| Ungated routes | grep for `BETA_COOKIE\|checkAdminAuth` | `/api/calculate` (telemetry only), `/api/cards`, `/api/reports`, `/api/telemetry`, `/api/correction-history`, `/api/health` |
| Rate limiting | grep `rateLimit\|429\|throttle` in `src/` | No matches |
| Code smells | grep `TODO\|FIXME\|HACK\|@ts-ignore\|as any\|.only(\|.skip(` in `src/`, `scripts/` | No matches |
| Verified card set | Parse `verified-card-set.ts` | 36 verified (30 `officially-documented`, 6 `statement-verified`) + 4 withheld (2 `inferred`, 2 `community-reported`) |
| Route-fact in catalog | grep `route-fact\|strategy` in `catalog-export.ts`, `change-feed.ts` | No matches — ticket 07 unbuilt |
| Seed routes yield | `strategy-seed.ts` | All 3 publishable routes use `pointsPerDollar: 0` |
| Gate override record | grep `gate override` in `.scratch/`, `docs/` | No matches |

### Files read in full for this report

`CONTEXT.md` · `README.md` · `docs/mvp-implementation-plan.md` · `docs/runbook-sept-30.md` · all 6 ADRs · `.scratch/payment-strategy/{map.md,spec.md,issues/01-07}` · `.scratch/mvp/map.md` · `.scratch/demo/{map.md,issues/05}` · `.scratch/agents/{issue-tracker,triage-labels}.md` · `middleware.ts` · `beta/{invite,invite-db}.ts` · `admin/auth.ts` · `engine/{calculate,types}.ts` · `strategy/{compose,route-fact,applicable,strategy-seed}.ts` · `app/strategy-annotation.ts` · `api/{calculate,reports,telemetry,cards,correction-history,health}/route.ts` · `api/calculate/validate.ts` · `db/{schema,client}.ts` · `admin/catalog-export.ts` · `catalog/evidence.ts` · `app/{page,invite/page,admin/page}.tsx` · `package.json` · `Dockerfile` · `docker-compose.yml` · `next.config.ts` · `drizzle.config.ts` · `.github/workflows/ci.yml` · `.env.example` · all 7 migrations · `scripts/docker-entrypoint.sh`

### Method notes

- **Context-mode indexing:** the repo was indexed into the knowledge base — `docs/` (15 files, 143 sections), `app/src/` (72 files, 129 sections), `app/migrations/` (7 sections), `app/scripts/` (13 sections), plus `CONTEXT.md` and the root docs.
- **No source file was modified.** The only file created is this report.
- **Verification was executed, not assumed.** Lint, build, and test were re-run in this session; CI status was read from `gh`. The claim that all four gates were green is **false as of today**.
- **Line counts** exclude `node_modules`, `.next`, and `.git`.

### Unverified / out of scope

- I did not run the database scripts (`migrate`, `seed`, `verify:seed`) — they need a live Postgres with `DATABASE_URL` exported, and the demo map notes the local stack is fragile (colima, shared VM). The demo map records them as previously verified green (ticket 04).
- I did not click through the UI in a browser. Frontend behaviour is assessed from source and tests only.
- The demo map's ticket 03 notes the invite and admin screens are **"not yet visually verified"** — that remains true.
- Vercel pricing, plan limits, and Postgres provider specifics were not researched.

