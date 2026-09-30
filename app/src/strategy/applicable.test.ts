import { describe, it, expect } from 'vitest'
import type { RedemptionScenario, TransactionContext } from '../engine/types'
import { applicableStrategies, strategiesForCard, strategiesFromRouteFacts, type RouteFactRecord } from './applicable'
import type { ComposedStrategy } from './compose'
import type { RouteFactRuleData } from './route-fact'

function fact(overrides: Partial<RouteFactRuleData> = {}, record: Partial<RouteFactRecord> = {}): RouteFactRecord {
  return {
    id: 'wallet-exclusion-hdfc-infinia',
    cardId: 'card-1',
    effectiveFrom: '2026-01-01',
    effectiveTo: null,
    evidenceStatus: 'officially-documented',
    retractedAt: null,
    ruleData: {
      ruleType: 'route-fact',
      effectiveMerchantCategory: 'wallet-load',
      exclusions: ['wallet-load'],
      pointsPerDollar: 0,
      capPoints: null,
      voucherFeeCents: 0,
      capGoverned: false,
      ...overrides,
    },
    ...record,
  }
}

const context: TransactionContext = {
  transactionId: 'txn-1',
  amount: 10_000, // ₹100
  merchantCategory: 'dining',
  merchantName: 'Swiggy',
  transactionDate: '2026-06-15',
}

const scenario: RedemptionScenario = {
  id: 'travel',
  cardId: 'card-1',
  redemptionType: 'travel',
  applicableCategories: [],
  effectiveFrom: '2026-01-01',
  effectiveTo: null,
  centsPerPoint: 1,
  annualFeeCents: 12_500_00,
}

describe('strategiesFromRouteFacts', () => {
  it('binds each curated fact to a purchase leg and a zero-earning redemption leg', () => {
    const [strategy] = strategiesFromRouteFacts([fact()])
    expect(strategy).toMatchObject({ id: 'wallet-exclusion-hdfc-infinia', kind: 'route' })
    expect(strategy.legs.map(leg => leg.id)).toEqual(['voucher-purchase', 'merchant-redemption'])
    expect(strategy.legs[0]).toMatchObject({ merchantCategory: 'wallet-load', capGoverned: false, verified: true })
    expect(strategy.legs[1].rule.ruleData).toMatchObject({ pointsPerDollar: 0, exclusions: [] })
  })

  it('marks a retracted route fact unverified so it cannot price as a number', () => {
    const [strategy] = strategiesFromRouteFacts([fact({}, { retractedAt: '2026-06-01T00:00:00Z' })])
    expect(strategy.legs.every(leg => leg.verified === false)).toBe(true)
  })

  it('ignores a rule that is not a route fact', () => {
    const direct = fact({}, { ruleData: { ruleType: 'variable' } })
    expect(strategiesFromRouteFacts([direct])).toEqual([])
  })
})

describe('applicableStrategies', () => {
  const resolved = (rewardValueCents: number): ComposedStrategy => ({
    resolved: true, strategyId: 's', kind: 'route', rewardValueCents, legs: [], legResults: [], trace: { transactionId: 't', entries: [] },
  })
  const unresolved: ComposedStrategy = {
    resolved: false, strategyId: 's', kind: 'route', blockingLegId: 'voucher-purchase', reason: 'unverified', legResults: [], trace: { transactionId: 't', entries: [] },
  }

  it('keeps a resolved route only when it earns more than paying directly', () => {
    expect(applicableStrategies([resolved(500)], 300).map(s => s.strategyId)).toEqual(['s'])
    expect(applicableStrategies([resolved(300)], 300)).toEqual([])
    expect(applicableStrategies([resolved(100)], 300)).toEqual([])
  })

  it('drops a resolved route when the direct outcome has no reward value to beat', () => {
    expect(applicableStrategies([resolved(500)], null)).toEqual([])
  })

  it('keeps an Unresolved route so the gap stays visible', () => {
    expect(applicableStrategies([unresolved], 300)).toEqual([unresolved])
  })
})

describe('strategiesForCard', () => {
  it('prices the seeded exclusion route at zero, so it does not beat the direct payment', () => {
    const strategies = strategiesForCard(context, [fact()], [scenario], 300)
    expect(strategies).toEqual([])
  })

  it('returns a resolved strategy when the route earns more than the direct payment', () => {
    const portal = fact({ effectiveMerchantCategory: 'gift-card', exclusions: [], pointsPerDollar: 10 })
    const [strategy] = strategiesForCard(context, [portal], [scenario], 300)
    expect(strategy?.resolved).toBe(true)
    if (!strategy?.resolved) return
    // ₹100 at 10 points per ₹, redeemed at 1 cent per point, minus no fee.
    expect(strategy.rewardValueCents).toBe(1000)
  })

  it('returns an Unresolved strategy with no reward value when the route fact was retracted', () => {
    const [strategy] = strategiesForCard(context, [fact({}, { retractedAt: '2026-06-01T00:00:00Z' })], [scenario], 300)
    expect(strategy?.resolved).toBe(false)
    if (!strategy || strategy.resolved) return
    expect(strategy).not.toHaveProperty('rewardValueCents')
    expect(strategy.blockingLegId).toBe('voucher-purchase')
  })

  it('returns nothing when the card has no curated route', () => {
    expect(strategiesForCard(context, [], [scenario], 300)).toEqual([])
  })
})
