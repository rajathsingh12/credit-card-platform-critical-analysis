import { toIsoDate } from '../catalog/db-mapping'
import type { EvidenceStatus } from '../catalog/evidence'
import type { RedemptionScenario, TransactionContext } from '../engine/types'
import { compose, type ComposedStrategy, type PaymentStrategyDefinition, type StrategyLeg } from './compose'
import { isRouteFactRuleData, routeFactToEngineRule } from './route-fact'

/**
 * One stored route fact, already fetched. The route handler maps its row into
 * this; the assembler never touches the database.
 */
export interface RouteFactRecord {
  id: string
  cardId: string
  effectiveFrom: string | Date
  effectiveTo: string | Date | null
  ruleData: unknown
  evidenceStatus: EvidenceStatus
  /** Set when the rule was retracted. A retracted leg cannot price the route. */
  retractedAt: string | null
}

/**
 * Turns the curated route facts fetched for one card into the strategies the
 * composer prices. Each fact is one route: the voucher-purchase leg the fact
 * describes, then a redemption leg that earns nothing — paying with stored
 * value is not a second earn. A fact that never cleared the gate, or whose
 * rule was retracted, stays in the set so it prices as Unresolved.
 */
export function strategiesFromRouteFacts(facts: RouteFactRecord[]): PaymentStrategyDefinition[] {
  return facts.flatMap(fact => {
    if (!isRouteFactRuleData(fact.ruleData)) return []
    const data = fact.ruleData
    const envelope = {
      cardId: fact.cardId,
      effectiveFrom: toIsoDate(fact.effectiveFrom),
      effectiveTo: fact.effectiveTo === null ? null : toIsoDate(fact.effectiveTo),
    }
    const shared = {
      scenarios: [] as RedemptionScenario[],
      evidenceStatus: fact.evidenceStatus,
      verified: fact.retractedAt === null,
    }
    const purchase: StrategyLeg = {
      id: 'voucher-purchase',
      merchantCategory: data.effectiveMerchantCategory,
      rule: routeFactToEngineRule(data, { ...envelope, id: fact.id }),
      voucherFeeCents: data.voucherFeeCents,
      capGoverned: data.capGoverned,
      ...shared,
    }
    // The redemption pays the merchant with the stored value and earns nothing on top.
    // Its category is the merchant's, filled in at price time.
    const redemption: StrategyLeg = {
      id: 'merchant-redemption',
      merchantCategory: '',
      rule: routeFactToEngineRule(
        { ...data, exclusions: [], pointsPerDollar: 0, voucherFeeCents: 0, capGoverned: false },
        { ...envelope, id: `${fact.id}:redemption` },
      ),
      ...shared,
    }
    return [{ id: fact.id, kind: 'route', legs: [purchase, redemption] }]
  })
}

/**
 * The strategies worth showing. A resolved route only qualifies when it beats
 * paying the card directly; an Unresolved route is shown so the gap stays honest.
 */
export function applicableStrategies(
  strategies: ComposedStrategy[],
  directRewardCents: number | null,
): ComposedStrategy[] {
  return strategies.filter(strategy =>
    strategy.resolved
      ? directRewardCents !== null && strategy.rewardValueCents > directRewardCents
      : true,
  )
}

/**
 * Price the curated facts for this purchase and keep only what is worth showing:
 * a resolved route that beats the direct outcome, or an Unresolved one.
 */
export function strategiesForCard(
  context: TransactionContext,
  facts: RouteFactRecord[],
  scenarios: RedemptionScenario[],
  directRewardCents: number | null,
): ComposedStrategy[] {
  const strategies = strategiesFromRouteFacts(facts).map(strategy => ({
    ...strategy,
    legs: strategy.legs.map(leg => ({
      ...leg,
      scenarios,
      merchantCategory: leg.id === 'merchant-redemption' ? context.merchantCategory : leg.merchantCategory,
    })),
  }))
  return applicableStrategies(compose(context, strategies), directRewardCents)
}
