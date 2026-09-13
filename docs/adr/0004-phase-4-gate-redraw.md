---
status: accepted
---

# Phase-4 Gate Redraw for Closed Beta

The Phase Gate in `docs/mvp-implementation-plan.md` requires two formally scoped Data Customer pilots and at least one paid conversion commitment. Both were ruled out of MVP scope at the Phase 0 human gate (02): Data Customer pilots are deferred post-MVP; Consumer Subscription billing is a plan non-goal. As written the gate cannot be passed.

This ADR replaces the Phase-4 gate with criteria the Closed Beta can actually meet.

## Redrawn criteria

1. **Engagement** — at least 50% of invite codes with activity (≥1 `decision_completed`) have ≥3 completed Transaction Decisions within the 30-day window.  _(Unchanged from the original gate except the identity is an invite code, not a session token.)_
2. **Correctness** — no open Critical Calculation Errors at window close.
3. **Correction loop** — every Contextual Report received during the window is triaged (resolved or dismissed) by window close.

## Cohort

- Exactly 10 invite codes, pre-generated and fixed. Each code is reusable (the same friend can return) but represents one person.
- **Floor**: at least 5 of the 10 codes must have ≥1 `decision_completed` in the window. Below the floor the verdict is **extend** (never pass or fail), because engagement data from fewer than half the cohort is not a signal.

## Extend rule

One extension of 30 days, only when the cohort floor is unmet. Every other criterion miss is a **fail** naming the specific criterion and whether the cause is product, data, or cohort.

## What was dropped and why

| Original criterion | Disposition | Reason |
|---|---|---|
| Two formally scoped Data Customer pilots | Dropped | Out of MVP scope (02) |
| At least one paid conversion commitment | Dropped | Consumer Subscription billing is a plan non-goal |

Nothing replaces them. They tested B2B viability; this beta tests consumer engagement and data correctness only.

## Implementation note

The runbook gate query (`docs/runbook.md` §11.3) currently counts by `session_token`, which already holds the invite code; its denominator must become the seeded codes before the beta window opens (`.scratch/mvp/issues/46`). Code generation is `.scratch/mvp/issues/47`. Criterion 3 has no triage record in the schema; where triage is recorded is decided with the steward routine (`.scratch/mvp/issues/41`). These are implementation issues, not map decisions.
