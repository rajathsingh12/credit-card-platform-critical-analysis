# Runbook — Payment Strategy (Phase 6)

_Authored 2026-09-30. The ordered path from **ADR 0006** to a shipped Payment Strategy, with the gates and guardrails that must not be skipped. Read this at the start of every session in this effort._

## 0. Source of truth (read before touching anything)

- `docs/adr/0006-payment-strategy-deferred-phase-6.md` — the decision and the 7 settled design points. **Authoritative.**
- `CONTEXT.md` — the **Payment Strategy** glossary entry and the terms to avoid.
- Supporting: ADR 0002/0003 (evidence + Publication Gate), ADR 0004 (Phase-4 gate), ADR 0005 (Reward Value), Issue 32 (channels), Issue 33 (periodic caps).

If anything below conflicts with ADR 0006, ADR 0006 wins — fix this runbook.

## 1. Precondition — the Phase-4 gate (do NOT skip)

Payment Strategy is **Phase 6**, a fresh effort that starts only after the MVP closed beta passes. Right now the gate is **not passed**: `.scratch/mvp/issues/43-phase-4-gate-verdict.md` is open, blocked by issue 42 (run the beta).

- **Until issue 43 records a `pass`:** do not `/implement` any Payment Strategy ticket.
- **Allowed now:** capture design (done), background `/research`, and — if you want a head start — `/to-spec` and `/to-tickets` (planning, not building).
- The MVP-closing path (run beta → record verdict) is its own work in `.scratch/mvp/`; finish it first.

## 2. Guardrails that never change

1. **Gate first.** No Payment Strategy build before the Phase-4 `pass` (see §1).
2. **Don't touch the engine.** `app/src/engine/calculate.ts`, `CalcResult`, and ADR 0005's Reward Value model stay unchanged. Compose *above* the single-card engine.
3. **Evidence or nothing.** Every route fact is a versioned Rule Version through the Publication Gate (ADR 0002/0003); `officially-documented` must cite the issuer's own domain. No assumed multipliers. The rewarded leg is the **voucher purchase** at its real MCC/exclusions; never double-count a zero-earning redemption leg. Facts that can't clear the gate → **Unresolved Outcome**, not a number.
4. **Reward Value, never "effective cost."** A strategy's value = sum of its legs' `grossReturnCents` − voucher purchase fees/discounts. The annual fee stays a separate chip.
5. **Curated routes only.** A verified, seeded Payment Strategy set — no open enumeration.
6. **Vocabulary.** Say "Payment Strategy." Never "recommendation", "best card", "effective cost", "hack". Use `CONTEXT.md` terms (domain-docs rule).
7. **Verify for real.** Keep the vitest suite DB-free; DB checks go in `app/scripts/` (`migrate`/`seed`/`verify:seed`) with `DATABASE_URL` exported. New tests must actually run (never "0 tests") and be able to fail. Run all four gates from `app/`: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`.
8. **Capped routes wait on caps.** Any route whose value depends on a monthly/quarterly cap is blocked on the Issue-33 ticket (T1); uncapped routes may ship first.

## 3. Copy-paste prompts

The whole build collapses to **three** slash-commands. Each block below is one paste into a **fresh** session, as your first message — the leading `/command` triggers the skill and the text after it is the brief (these commands can't self-start, so you must paste them). Replace anything in `<angle brackets>`. `/to-spec` and `/to-tickets` will pause to confirm seams and ticket granularity with you — answer, then let them finish.

### Session 1 — research the route facts (optional, safe before the gate)

```
/research What reward multipliers do Indian voucher/gift-card portals (e.g. GyFTR and bank-branded GyFTR portals) offer for Swiggy and dining — with what caps, eligibility windows, and denominations? What MCC does a voucher purchase code as, and which premium cards (HDFC Infinia/Diners Black, Axis, ICICI) exclude gift-card/wallet MCCs from rewards? Cite issuer T&Cs and portal terms as primary sources and save the findings as a Markdown file in the repo.
```

### Session 2 — spec, then tickets (same window; do NOT `/clear` between the two)

Paste this first:

```
/to-spec Read docs/adr/0006-payment-strategy-deferred-phase-6.md and the "Payment Strategy" entry in CONTEXT.md and synthesise the spec from that ADR — don't re-interview me. Hold docs/runbook-sept-30.md §2: compose above the untouched engine (do NOT modify app/src/engine/calculate.ts or CalcResult), rank by Reward Value not "effective cost", every route fact is a versioned rule through the Publication Gate (ADR 0002/0003), routes are curated not enumerated, capped routes depend on Issue 33. Phase 6 — spec only, no code.
```

After it publishes the spec, paste this:

```
/to-tickets Break the Payment Strategy spec into tracer-bullet tickets under .scratch/payment-strategy/issues/, blockers first. Start from docs/runbook-sept-30.md §4: T1 periodic-cap modelling (Issue 33), T2 versioned route-rule type + Publication-Gate wiring, T3 composition layer above the engine, T4 trace composition header, T5 curated verified route seed, T6 output/annotation contract — edges T2→{T3,T5}, T3→{T4,T6}, T1 before any capped route. Keep the engine untouched; use CONTEXT.md vocabulary.
```

### Session 3+ — build one ticket per fresh session

`/to-tickets` numbers the files `01, 02, …` in dependency order, so just work them in order. `/clear` first, then paste (swap in the ticket file):

```
/implement .scratch/payment-strategy/issues/<NN-slug>.md — first read docs/adr/0006-payment-strategy-deferred-phase-6.md and docs/runbook-sept-30.md §2, then stay inside them: do NOT touch app/src/engine/calculate.ts or CalcResult (compose above the engine), keep the vitest suite DB-free with DB checks in app/scripts, and rank by Reward Value. Before claiming done, run npm run lint, npm run typecheck, npm test and npm run build from app/, and confirm the new tests actually execute (not "0 tests") and go red when the logic breaks — don't tick a box you didn't run.
```

`/implement` runs `/tdd` and `/code-review` for you and commits. `/clear` before the next ticket.

### Side paths (as needed)

- Raw bug/feature reports you didn't write → `/triage` (never triage `/to-tickets` output).
- A step only a human can do (secrets, provisioning, a dashboard) → `/wizard`.
- Something breaks and resists a first look → `/diagnosing-bugs`.

## 4. Expected ticket shape

`/to-tickets` produces the authoritative list; this is the expected decomposition and blocking order so you can sanity-check it.

| # | Ticket | Blocked by | Unblocks |
|---|---|---|---|
| T1 | Periodic-cap modeling (build out Issue 33) | — | capped routes in T5 |
| T2 | Versioned route-rule type + Publication-Gate wiring | — | T3, T5 |
| T3 | Composition layer above the engine (compose legs, net voucher fees, emit Unresolved) | T2 | T4, T6 |
| T4 | Calculation-trace composition header | T3 | — |
| T5 | Curated Payment Strategy seed (verified route set) | T2 (+ T1 for capped routes) | T6 |
| T6 | Output/annotation contract (strategy attached to its card, labeled) | T3 | — |

Order: **T2 first**, then **T3** and **T5** can proceed; **T4** and **T6** after T3; **T1** any time before a capped route. Uncapped routes reach the UI via T2 → T3 → T6 without waiting on T1.

## 5. Per-session checklist

**Start:** read ADR 0006 + the `CONTEXT.md` Payment Strategy entry · confirm the Phase-4 gate status (issue 43) · pick a ticket whose blockers are done.
**During:** stay in the glossary vocabulary · don't touch the engine · build test-first.
**End:** run `lint` / `typecheck` / `test` / `build` from `app/` · confirm new tests ran and can fail · commit · `/clear`.
**Never:** build before the gate passes · assume a multiplier · use "recommendation/best-card/effective-cost" language · check a box on a test you didn't run.
