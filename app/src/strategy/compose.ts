import { calculate } from '../engine/calculate'
import type { EvidenceStatus } from '../catalog/evidence'
import type { CalcResult, CalculationTrace, RedemptionScenario, RuleVersion, TraceEntry, TransactionContext } from '../engine/types'

/**
 * One priced step of a Payment Strategy. `rule` is already an engine rule —
 * a route-fact leg arrives pre-projected by routeFactToEngineRule (ticket 01).
 * The composer never fetches anything: `voucherFeeCents`, `capGoverned`, and
 * `verified` are facts the caller already resolved.
 */
export interface StrategyLeg {
  id: string
  /** The category this leg actually codes as. A voucher leg uses its effective MCC, not the merchant's. */
  merchantCategory: string
  rule: RuleVersion
  scenarios: RedemptionScenario[]
  /** Per-purchase fee in paise. Positive = fee, negative = discount. Only the route's purchase leg carries one. */
  voucherFeeCents?: number
  /** The route fact says a periodic cap governs this leg, but none is modelled on its rule. */
  capGoverned?: boolean
  /** false = the fact never cleared the Publication Gate. */
  verified?: boolean
  /** The Verification Record's Evidence Status. The header binds to the weakest leg. */
  evidenceStatus?: EvidenceStatus
}

export interface PaymentStrategyDefinition {
  id: string
  kind: 'direct' | 'route'
  legs: StrategyLeg[]
}

export interface ResolvedStrategy {
  resolved: true
  strategyId: string
  kind: 'direct' | 'route'
  /** Σ leg grossReturnCents − the route's voucher fee. The annual fee is not in here (ADR 0005). */
  rewardValueCents: number
  legs: { legId: string; grossReturnCents: number }[]
  legResults: CalcResult[]
  trace: CalculationTrace
}

export interface UnresolvedStrategy {
  resolved: false
  strategyId: string
  kind: 'direct' | 'route'
  blockingLegId: string
  reason: string
  legResults: CalcResult[]
  trace: CalculationTrace
}

export type ComposedStrategy = ResolvedStrategy | UnresolvedStrategy

/** The composition header is one ordinary trace entry. Its `assumptions` carry the strategy facts a single rule's entry has no field for. */
interface HeaderFacts {
  legs: { legId: string; earnedCents: number; reason: string | null }[]
  voucherFeeCents: number
  rewardValueCents: number | null
  evidenceStatus: EvidenceStatus | null
  blockingLegId?: string
}

/**
 * Price each candidate Payment Strategy from data the caller already fetched.
 * DB-free: every leg goes through the existing calculate(), which is not modified.
 */
export function compose(
  context: TransactionContext,
  strategies: PaymentStrategyDefinition[],
): ComposedStrategy[] {
  return strategies.map(strategy => composeOne(context, strategy))
}

function composeOne(context: TransactionContext, strategy: PaymentStrategyDefinition): ComposedStrategy {
  const legResults: CalcResult[] = []
  const legs: { legId: string; earnedCents: number; reason: string | null }[] = []
  let voucherFeeCents = 0
  let evidenceStatus: EvidenceStatus | null = null

  for (const leg of strategy.legs) {
    if (leg.verified === false) {
      return unresolved(context, strategy, leg.id, `leg "${leg.id}" is not verified`, legResults, legs, voucherFeeCents, evidenceStatus)
    }

    // A cap the platform cannot model must not be priced as if it weren't there.
    if (leg.capGoverned && leg.rule.ruleData.periodicCap === undefined) {
      return unresolved(context, strategy, leg.id, `leg "${leg.id}" is governed by a periodic cap that is not modelled`, legResults, legs, voucherFeeCents, evidenceStatus)
    }

    const result = calculate(
      { ...context, merchantCategory: leg.merchantCategory },
      [pricedRule(leg)],
      leg.scenarios,
    )
    legResults.push(result)
    voucherFeeCents += leg.voucherFeeCents ?? 0
    evidenceStatus = weaker(evidenceStatus, leg.evidenceStatus)

    if (!result.resolved) {
      return unresolved(context, strategy, leg.id, `leg "${leg.id}" is unresolved: ${result.reason}`, legResults, legs, voucherFeeCents, evidenceStatus)
    }

    // Nothing matched — excluded or out of scope — earns nothing. A matched leg
    // states a cash value, because pricedRule rewrites direct rules to variable.
    const earned = result.ruleApplied === null ? 0 : result.grossReturnCents
    if (earned === null) throw new Error(`leg "${leg.id}" matched with no reward value`)
    legs.push({ legId: leg.id, earnedCents: earned, reason: earned === 0 ? legReason(result) : null })
  }

  const rewardValueCents = legs.reduce((sum, leg) => sum + leg.earnedCents, 0) - voucherFeeCents
  return {
    resolved: true,
    strategyId: strategy.id,
    kind: strategy.kind,
    rewardValueCents,
    legs: legs.map(({ legId, earnedCents }) => ({ legId, grossReturnCents: earnedCents })),
    legResults,
    trace: strategyTrace(context, { legs, voucherFeeCents, rewardValueCents, evidenceStatus }, legResults),
  }
}

/**
 * A direct rule states points but no cash value, and route-fact legs arrive as
 * direct rules (ticket 01). Reward Value needs the cash value, so a direct leg
 * is priced as variable — the same points, valued by the leg's redemption scenario.
 */
function pricedRule(leg: StrategyLeg): RuleVersion {
  if (leg.rule.ruleData.ruleType !== 'direct') return leg.rule
  return { ...leg.rule, ruleData: { ...leg.rule.ruleData, ruleType: 'variable' } }
}

function unresolved(
  context: TransactionContext,
  strategy: PaymentStrategyDefinition,
  blockingLegId: string,
  reason: string,
  legResults: CalcResult[],
  legs: HeaderFacts['legs'],
  voucherFeeCents: number,
  evidenceStatus: EvidenceStatus | null,
): UnresolvedStrategy {
  return {
    resolved: false,
    strategyId: strategy.id,
    kind: strategy.kind,
    blockingLegId,
    reason,
    legResults,
    trace: strategyTrace(
      context,
      { legs: [...legs, { legId: blockingLegId, earnedCents: 0, reason }], voucherFeeCents, rewardValueCents: null, evidenceStatus, blockingLegId },
      legResults,
    ),
  }
}

// ponytail: fixed rank, weakest binds. Revisit if Evidence Status gains a level.
const EVIDENCE_RANK: EvidenceStatus[] = ['officially-documented', 'statement-verified', 'inferred', 'community-reported']

function weaker(current: EvidenceStatus | null, next: EvidenceStatus | undefined): EvidenceStatus | null {
  if (next === undefined) return current
  if (current === null) return next
  return EVIDENCE_RANK.indexOf(next) > EVIDENCE_RANK.indexOf(current) ? next : current
}

/** The reason the engine already recorded for a leg that earned nothing. */
function legReason(result: CalcResult): string | null {
  const applied = result.trace.entries.find(entry => entry.applied) ?? result.trace.entries[0]
  return applied?.reason ?? null
}

const EMPTY_INPUTS: TraceEntry['inputs'] = {
  amount: 0, merchantCategory: '', transactionDate: '', pointsPerDollar: 0, categories: [], exclusions: [], capPoints: null,
}

/** One ordinary trace entry carrying the strategy facts, ahead of each leg's own entries in order. */
function strategyTrace(context: TransactionContext, facts: HeaderFacts, legResults: CalcResult[]): CalculationTrace {
  const header: TraceEntry = {
    ruleId: 'payment-strategy',
    ruleEffectiveFrom: context.transactionDate,
    applied: facts.blockingLegId === undefined,
    reason: facts.blockingLegId === undefined
      ? 'composed from resolved legs'
      : `unresolved: blocking leg "${facts.blockingLegId}"`,
    inputs: { ...EMPTY_INPUTS, amount: context.amount, transactionDate: context.transactionDate },
    assumptions: [JSON.stringify(facts)],
    pointsBeforeCap: null,
    pointsAfterCap: null,
  }
  return {
    transactionId: context.transactionId,
    entries: [header, ...legResults.flatMap(result => result.trace.entries)],
  }
}
