---
status: accepted
---

# Rank by Reward Value, not fee-amortized Net Return

The engine ranked Transaction Outcomes by `netReturnCents = grossReward − annualFee/12`, charging a full month's annual fee against a single transaction. This made premium high-fee cards look catastrophic even when they earned more rewards — on a ₹5,000 Utilities spend, HDFC Infinia (earns ₹166.00) showed −₹875.67 against Regalia Gold's −₹141.83 purely because ₹12,500/12 was subtracted from one transaction.

The product answers "which card wins this spend?". For that question the annual fee is a fixed holding cost, not a per-transaction cost, so amortizing it into a single transaction is the wrong model.

## Decision

Rank by **Reward Value** — the reward earned on the transaction (`grossReturnCents` = points × centsPerPoint). Surface the full annual fee separately as context (`annualFeeCents`, rendered as a "₹X/yr" chip), never netted into the ranked figure.

`TransactionOutcome.netReturnCents` / `annualFeeAmortizedCents` are removed in favour of `grossReturnCents` / `annualFeeCents`.

## Consequences

- The glossary term **Net Return** is replaced by **Reward Value** (`CONTEXT.md`).
- Premium high-fee cards are ranked on the rewards they actually earn; the fee stays visible but no longer distorts the ranking.
- Amortization is gone: a one-month slice of the holding cost is not weighed against a single spend. A total-cost-of-ownership view (annualized rewards vs annual fee) would be its own feature, not this per-transaction ranking.
- Golden dataset expectations were recomputed to exact gross value + full annual fee, not weakened (`.scratch/demo/issues/06-rank-by-reward-value.md`).
