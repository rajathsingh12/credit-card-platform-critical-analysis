---
status: accepted
---

# Payment Strategy: a deferred Phase-6 optimization capability

A review suggestion (`docs/antman-review-suggestion.md`) argued the platform should answer not only "which card should I use?" but "what is the most reward-efficient way to make this purchase?" — e.g. paying a Swiggy bill by first buying a Swiggy voucher through a portal that carries a reward multiplier, rather than paying the merchant directly.

Inspecting the code first:

- There is no "recommendation engine." Cross-card ranking is client-side (`app/src/app/home-client.tsx` `rankResults`), sorting each card's outcome by Reward Value (`grossReturnCents`) per ADR 0005. The engine (`app/src/engine/calculate.ts`) is single-card — it selects the best-earning rule for one card and applies a Redemption Scenario.
- There is no model for vouchers, reward multipliers, partner portals, payment channels (Issue 32), or month-to-date / periodic caps (Issue 33). `RewardRuleData` carries only `pointsPerDollar` and a per-transaction `capPoints`.
- The suggestion's vocabulary ("recommendation engine", "best card", "effective cost") collides with `CONTEXT.md`'s deliberate avoidances and with ADR 0005, which already rejected fee-amortized net-cost framing in favour of Reward Value.
- The suggestion's headline example (`83 × 5 = 415` points) is itself an evidence risk: it assumes an unverified multiplier and mislocates the rewarded transaction. In a voucher route the rewarded transaction is the voucher *purchase*, carried at its own MCC — often a gift-card/wallet category that premium cards exclude — and the later redemption at the merchant usually earns nothing. Modelled naively that is a Critical Calculation Error, which the evidence standard (ADR 0002, ADR 0003) exists to prevent.

The distinction is real and valuable, but it lands in the deferred optimization space, depends on data the platform cannot yet meet its evidence standard on, and must be reframed out of "recommendation" language.

## Decision

Adopt the capability under the name **Payment Strategy** and defer it to **Phase 6 (First Expansion)**, behind the Phase-4 Closed-Beta gate (ADR 0004). Record the design now; build nothing this cycle. The current engine, its output contract, and the MVP (Phases 0–4) are untouched.

Settled design:

1. **Name.** A **Payment Strategy** is the way a Cardholder executes one purchase to maximise Reward Value — a direct card payment, or a multi-step route composing more than one Transaction Outcome. **Transaction Decision** remains the choice of *which card*. It extends the **Consumer Wedge**. Avoid "recommendation", "best card/route", "hack", "effective cost".
2. **Metric.** Rank by **Reward Value** (ADR 0005 upheld). A strategy's Reward Value = the sum of its legs' `grossReturnCents` minus any voucher purchase fees or discounts — a genuine per-purchase cost, distinct from the annual fee, which stays a separately surfaced holding cost and is never netted.
3. **Evidence and correctness.** A Payment Strategy may only be published from versioned, evidence-graded Rule Versions that pass the Publication Gate (ADR 0002, ADR 0003). No assumed multipliers; the rewarded leg is the voucher purchase at its real MCC and exclusions; no double-counting a redemption leg that earns nothing. A route whose facts cannot clear the gate resolves to an **Unresolved Outcome**, not a number.
4. **Representation and compute layer.** A Payment Strategy is a *composite of Transaction Outcomes*: each leg is computed by the existing single-card engine, and a new composition layer above it sums the legs and nets voucher fees. `app/src/engine/calculate.ts` and `CalcResult` are unchanged. Portal/multiplier facts become a new versioned rule type riding the existing Rule Version + Verification Record + Publication Gate machinery, not a parallel store.
5. **Route scope.** Only a curated, evidence-verified set of Payment Strategies is evaluated, gated like the **Verified Card Set** — not open enumeration across all vouchers and portals. Coverage grows only as routes clear the evidence bar.
6. **Calculation Trace.** A strategy's trace is the ordered concatenation of each leg's `TraceEntry` list plus one composition header: the legs in order, which leg earned and which earned zero and why, the fee netted out, the total Reward Value, and the binding evidence status. When Unresolved, the header names the blocking leg. No new trace primitive.
7. **Output contract.** Annotation, not inline. The card ranking (the Transaction Decision) stays the primary answer; a verified higher-value Payment Strategy attaches to its card as a clearly-labelled optimization, never a row in the card list. This keeps "a strategy, not a different card" visible, as the suggestion itself asks.

## Consequences

- `CONTEXT.md` gains **Payment Strategy**; **Portfolio Optimization** gains a note distinguishing it (single-purchase route vs. cross-transaction portfolio).
- ADR 0005's per-transaction Reward Value model is upheld and extended, not replaced. No contradiction with existing ADRs.
- Many plausible routes will surface as Unresolved Outcome rather than a value — accepted, and consistent with the platform's trust posture.
- **Predecessors.** Issue 33 (month-to-date / periodic cap modelling) is a hard predecessor for any *capped* route, because an uncapped computation overstates Reward Value once a cap is hit; uncapped routes may publish first. Issue 32 (channel-aware rules) is related but not required.
- **Future acceptance shape** (for the Phase-6 ticket, mirroring Issue 32): the versioned route-rule contract, the composition-layer API, deterministic leg/fee/cap semantics, curated route seeding under the evidence standard, trace assertions, and the annotation output contract — with tests for direct-vs-route, multiplier, caps, ineligible/unverified routes (→ Unresolved), voucher-fee netting, and no double-count.

## What was rejected and why

| Option | Disposition | Reason |
|---|---|---|
| "Effective cost" / net-of-reward ranking | Rejected | Reintroduces the fee framing ADR 0005 removed; Reward Value is the ranking axis |
| Inline ranking of strategies with cards | Rejected | Blurs the card-vs-strategy line the suggestion itself warns against |
| Open route enumeration | Rejected | Multiplies the core data-verification cost and invites unverified-multiplier errors |
| Blanket/assumed voucher multiplier | Rejected | Manufactures Critical Calculation Errors; violates ADR 0002/0003 |
| New rule type inside the engine | Rejected | Disturbs the MVP engine and ADR 0005's per-transaction model; compose above it instead |
| Adopt into MVP (Phases 0–4) | Rejected | Beyond the MVP Boundary; depends on unmet evidence and cap modelling |
