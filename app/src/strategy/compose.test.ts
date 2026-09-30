import { describe, it, expect } from 'vitest'
import { compose, type PaymentStrategyDefinition, type StrategyLeg } from './compose'
import { routeFactToEngineRule, type RouteFactRuleData } from './route-fact'
import type { EvidenceStatus } from '../catalog/evidence'
import type { CalculationTrace, PeriodicCapConfig, RedemptionScenario, RuleVersion, TransactionContext } from '../engine/types'

// --- helpers ---

function makeContext(overrides: Partial<TransactionContext> = {}): TransactionContext {
  return {
    transactionId: 'txn-1',
    amount: 10_000, // ₹100
    merchantCategory: 'dining',
    merchantName: 'Test Restaurant',
    transactionDate: '2026-06-15',
    ...overrides,
  }
}

function makeRule(
  id: string,
  overrides: {
    ruleType?: 'direct' | 'variable'
    categories?: string[]
    exclusions?: string[]
    pointsPerDollar?: number
    periodicCap?: PeriodicCapConfig
  } = {},
): RuleVersion {
  return {
    id,
    cardId: 'card-1',
    effectiveFrom: '2026-01-01',
    effectiveTo: null,
    ruleData: {
      ruleType: overrides.ruleType ?? 'variable',
      categories: overrides.categories ?? [],
      exclusions: overrides.exclusions ?? [],
      pointsPerDollar: overrides.pointsPerDollar ?? 1,
      capPoints: null,
      ...(overrides.periodicCap ? { periodicCap: overrides.periodicCap } : {}),
    },
  }
}

function makeScenario(id: string, annualFeeCents: number | null = 12_500_00): RedemptionScenario {
  return {
    id,
    cardId: 'card-1',
    redemptionType: 'travel',
    applicableCategories: [],
    effectiveFrom: '2026-01-01',
    effectiveTo: null,
    centsPerPoint: 1,
    annualFeeCents,
  }
}

function leg(
  id: string,
  merchantCategory: string,
  rule: RuleVersion,
  extra: Partial<StrategyLeg> & { evidenceStatus?: EvidenceStatus } = {},
): StrategyLeg {
  return { id, merchantCategory, rule, scenarios: [makeScenario('travel')], evidenceStatus: 'officially-documented', ...extra }
}

function strategy(id: string, kind: 'direct' | 'route', legs: StrategyLeg[]): PaymentStrategyDefinition {
  return { id, kind, legs }
}

// ₹100 at N points per ₹, redeemed at 1 cent per point → N×100 cents.
const context = () => makeContext()

/** The composition header is the first trace entry; its assumptions hold the strategy facts. */
function headerOf(trace: CalculationTrace) {
  return JSON.parse(trace.entries[0].assumptions[0]) as {
    legs: { legId: string; earnedCents: number; reason: string | null }[]
    voucherFeeCents: number
    rewardValueCents: number | null
    evidenceStatus: EvidenceStatus | null
    blockingLegId?: string
  }
}

describe('strategy calculation trace', () => {
  it('a resolved route concatenates each leg trace in order under one composition header', () => {
    const [route] = compose(context(), [
      strategy('voucher-route', 'route', [
        leg('purchase', 'gift-card', makeRule('portal-voucher', { categories: ['gift-card'], pointsPerDollar: 10 }), { voucherFeeCents: 250, evidenceStatus: 'officially-documented' }),
        leg('redemption', 'dining', makeRule('merchant-redeem', { categories: ['dining'], pointsPerDollar: 0 }), { evidenceStatus: 'statement-verified' }),
      ]),
    ])

    expect(route?.resolved).toBe(true)
    if (!route?.resolved) return

    // The header is one ordinary trace entry; every entry after it is a leg's own, purchase then redemption.
    expect(headerOf(route.trace)).toEqual({
      legs: [
        { legId: 'purchase', earnedCents: 1000, reason: null },
        { legId: 'redemption', earnedCents: 0, reason: 'selected: highest earn rate among matching rules' },
      ],
      voucherFeeCents: 250,
      rewardValueCents: 750,
      evidenceStatus: 'statement-verified',
    })
    expect(route.trace.entries[0]).toMatchObject({ ruleId: 'payment-strategy', applied: true })
    expect(route.trace.entries.slice(1).map(e => e.ruleId)).toEqual(['portal-voucher', 'merchant-redeem'])
    expect(route.trace.entries[1]).toMatchObject({ applied: true, pointsAfterCap: 1000 })
  })

  it('a zero-earning excluded leg is named in the header with the reason, and the fee is still netted', () => {
    const [route] = compose(context(), [
      strategy('voucher-route', 'route', [
        leg('purchase', 'gift-card', makeRule('portal-voucher', { categories: ['gift-card'], exclusions: ['gift-card'], pointsPerDollar: 10 }), { voucherFeeCents: 150 }),
        leg('redemption', 'dining', makeRule('merchant-redeem', { categories: ['dining'], pointsPerDollar: 3 })),
      ]),
    ])

    expect(route?.resolved).toBe(true)
    if (!route?.resolved) return
    expect(headerOf(route.trace)).toEqual({
      legs: [
        { legId: 'purchase', earnedCents: 0, reason: 'category "gift-card" is excluded' },
        { legId: 'redemption', earnedCents: 300, reason: null },
      ],
      voucherFeeCents: 150,
      rewardValueCents: 150,
      evidenceStatus: 'officially-documented',
    })
  })

  it('an Unresolved route names the blocking leg and why, with no Reward Value', () => {
    const [route] = compose(context(), [
      strategy('voucher-route', 'route', [
        leg('purchase', 'gift-card', makeRule('portal-voucher', { categories: ['gift-card'], pointsPerDollar: 10 }), { verified: false }),
        leg('redemption', 'dining', makeRule('merchant-redeem', { categories: ['dining'], pointsPerDollar: 0 })),
      ]),
    ])

    expect(route?.resolved).toBe(false)
    if (!route || route.resolved) return
    expect(route.trace.entries).toHaveLength(1)
    expect(route.trace.entries[0]).toMatchObject({ applied: false, reason: 'unresolved: blocking leg "purchase"' })
    expect(headerOf(route.trace)).toEqual({
      legs: [{ legId: 'purchase', earnedCents: 0, reason: 'leg "purchase" is not verified' }],
      voucherFeeCents: 0,
      rewardValueCents: null,
      evidenceStatus: null,
      blockingLegId: 'purchase',
    })
  })
})

describe('route beats direct', () => {
  it('a voucher route earns more than paying the merchant directly', () => {
    const result = compose(context(), [
      strategy('direct', 'direct', [
        leg('swipe', 'dining', makeRule('direct-dining', { categories: ['dining'], pointsPerDollar: 3 })),
      ]),
      strategy('voucher-route', 'route', [
        leg('purchase', 'gift-card', makeRule('portal-voucher', { categories: ['gift-card'], pointsPerDollar: 10 })),
        leg('redemption', 'dining', makeRule('merchant-redeem', { categories: ['dining'], pointsPerDollar: 0 })),
      ]),
    ])

    const route = result.find(r => r.strategyId === 'voucher-route')
    const direct = result.find(r => r.strategyId === 'direct')
    expect(route?.resolved).toBe(true)
    expect(direct?.resolved).toBe(true)
    if (route?.resolved && direct?.resolved) {
      expect(route.rewardValueCents).toBe(1000)
      expect(direct.rewardValueCents).toBe(300)
      expect(route.rewardValueCents).toBeGreaterThan(direct.rewardValueCents)
    }
  })
})

describe('excluded MCC earns zero', () => {
  it('a voucher leg whose MCC the card excludes contributes nothing, so the route loses to direct', () => {
    const result = compose(context(), [
      strategy('direct', 'direct', [
        leg('swipe', 'dining', makeRule('direct-dining', { categories: ['dining'], pointsPerDollar: 3 })),
      ]),
      strategy('voucher-route', 'route', [
        leg('purchase', 'gift-card', makeRule('portal-voucher', { categories: ['gift-card'], exclusions: ['gift-card'], pointsPerDollar: 10 }), { voucherFeeCents: 150 }),
        leg('redemption', 'dining', makeRule('merchant-redeem', { categories: ['dining'], pointsPerDollar: 3 })),
      ]),
    ])

    const route = result.find(r => r.strategyId === 'voucher-route')
    expect(route?.resolved).toBe(true)
    if (route?.resolved) {
      // The excluded purchase leg earns 0, and the redemption leg is not counted twice.
      expect(route.legs).toEqual([
        { legId: 'purchase', grossReturnCents: 0 },
        { legId: 'redemption', grossReturnCents: 300 },
      ])
      // The purchase earned nothing, but the voucher fee was still paid.
      expect(route.rewardValueCents).toBe(300 - 150)
    }
  })
})

describe('unverified leg', () => {
  it('a route with an unverified fact is Unresolved, naming that leg', () => {
    const [route] = compose(context(), [
      strategy('voucher-route', 'route', [
        leg('purchase', 'gift-card', makeRule('portal-voucher', { categories: ['gift-card'], pointsPerDollar: 10 }), { verified: false }),
        leg('redemption', 'dining', makeRule('merchant-redeem', { categories: ['dining'], pointsPerDollar: 0 })),
      ]),
    ])

    expect(route?.resolved).toBe(false)
    if (route && !route.resolved) {
      expect(route.blockingLegId).toBe('purchase')
    }
  })
})

describe('voucher fee netting', () => {
  it('the route fee reduces Reward Value and the annual fee does not', () => {
    const [route] = compose(context(), [
      strategy('voucher-route', 'route', [
        leg('purchase', 'gift-card', makeRule('portal-voucher', { categories: ['gift-card'], pointsPerDollar: 10 }), { voucherFeeCents: 250 }),
        leg('redemption', 'dining', makeRule('merchant-redeem', { categories: ['dining'], pointsPerDollar: 0 })),
      ]),
    ])

    expect(route?.resolved).toBe(true)
    if (route?.resolved) {
      // 1000 earned − 250 fee. The scenario's ₹12,500 annual fee is never netted in (ADR 0005).
      expect(route.rewardValueCents).toBe(750)
    }
  })

  it('a voucher discount increases Reward Value', () => {
    const [route] = compose(context(), [
      strategy('voucher-route', 'route', [
        leg('purchase', 'gift-card', makeRule('portal-voucher', { categories: ['gift-card'], pointsPerDollar: 10 }), { voucherFeeCents: -100 }),
      ]),
    ])

    expect(route?.resolved).toBe(true)
    if (route?.resolved) expect(route.rewardValueCents).toBe(1100)
  })
})

describe('no double-count', () => {
  it('a redemption leg that earns nothing adds zero, once', () => {
    const [route] = compose(context(), [
      strategy('voucher-route', 'route', [
        leg('purchase', 'gift-card', makeRule('portal-voucher', { categories: ['gift-card'], pointsPerDollar: 10 })),
        leg('redemption', 'dining', makeRule('merchant-redeem', { categories: ['dining'], pointsPerDollar: 0 })),
      ]),
    ])

    expect(route?.resolved).toBe(true)
    if (route?.resolved) {
      expect(route.legs.map(l => l.grossReturnCents)).toEqual([1000, 0])
      expect(route.rewardValueCents).toBe(1000)
    }
  })
})

describe('unmodelled periodic cap', () => {
  it('a cap-governed leg with no modelled cap is Unresolved rather than priced in full', () => {
    const [route] = compose(context(), [
      strategy('capped-route', 'route', [
        leg('purchase', 'gift-card', makeRule('portal-voucher', { categories: ['gift-card'], pointsPerDollar: 10 }), { capGoverned: true }),
      ]),
    ])

    expect(route?.resolved).toBe(false)
    if (route && !route.resolved) expect(route.blockingLegId).toBe('purchase')
  })

  it('a cap-governed leg whose cap is modelled is priced, and a missing usage is the engine Unresolved', () => {
    const cap: PeriodicCapConfig = { period: 'monthly', maxPoints: 100, resetBasis: 'calendar', timezone: 'Asia/Kolkata' }
    const [route] = compose(context(), [
      strategy('capped-route', 'route', [
        leg('purchase', 'gift-card', makeRule('portal-voucher', { categories: ['gift-card'], pointsPerDollar: 10, periodicCap: cap }), { capGoverned: true }),
      ]),
    ])

    // No periodic usage was supplied, so the engine cannot state the value.
    expect(route?.resolved).toBe(false)
    if (route && !route.resolved) expect(route.blockingLegId).toBe('purchase')
  })
})

describe('a route-fact leg, projected the way ticket 01 projects it', () => {
  it('prices the voucher purchase at its redemption value instead of zero', () => {
    const fact: RouteFactRuleData = {
      ruleType: 'route-fact',
      effectiveMerchantCategory: 'gift-card',
      exclusions: [],
      pointsPerDollar: 10,
      capPoints: null,
      voucherFeeCents: 250,
      capGoverned: false,
    }
    const rule = routeFactToEngineRule(fact, {
      id: 'portal-voucher', cardId: 'card-1', effectiveFrom: '2026-01-01', effectiveTo: null,
    })

    const [route] = compose(context(), [
      strategy('voucher-route', 'route', [
        leg('purchase', fact.effectiveMerchantCategory, rule, {
          scenarios: [makeScenario('travel')],
          voucherFeeCents: fact.voucherFeeCents,
        }),
      ]),
    ])

    // ₹100 at 10 points/₹ = 1000 points, redeemed at 1 cent/point, minus the ₹2.50 fee.
    expect(route?.resolved).toBe(true)
    if (route?.resolved) expect(route.rewardValueCents).toBe(750)
  })
})
