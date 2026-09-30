import { describe, it, expect } from 'vitest'
import {
  isRouteFactRuleData,
  validateRouteFactRuleData,
  routeFactToEngineRule,
  type RouteFactRuleData,
} from './route-fact'
import { calculate } from '../engine/calculate'
import { validateEvidenceStandard } from '../admin/publish'
import type { TransactionContext } from '../engine/types'

// --- helpers ---

function makeRouteFact(overrides: Partial<RouteFactRuleData> = {}): RouteFactRuleData {
  return {
    ruleType: 'route-fact',
    effectiveMerchantCategory: 'gift-card',
    exclusions: ['wallet-load', 'fuel'],
    pointsPerDollar: 0.05,
    capPoints: null,
    voucherFeeCents: 0,
    capGoverned: false,
    ...overrides,
  }
}

function makeEnvelope() {
  return {
    id: 'rv-route-1',
    cardId: 'card-1',
    effectiveFrom: '2026-01-01',
    effectiveTo: null,
  }
}

function makeContext(overrides: Partial<TransactionContext> = {}): TransactionContext {
  return {
    transactionId: 'txn-route-1',
    amount: 100_000, // ₹1000
    merchantCategory: 'gift-card',
    merchantName: 'GyFTR Portal',
    transactionDate: '2026-06-15',
    ...overrides,
  }
}

// --- type guard ---

describe('isRouteFactRuleData', () => {
  it('accepts a valid route-fact', () => {
    expect(isRouteFactRuleData(makeRouteFact())).toBe(true)
  })

  it('rejects a direct rule', () => {
    expect(isRouteFactRuleData({ ruleType: 'direct', categories: [], exclusions: [], pointsPerDollar: 1, capPoints: null })).toBe(false)
  })

  it('rejects null', () => {
    expect(isRouteFactRuleData(null)).toBe(false)
  })

  it('rejects missing effectiveMerchantCategory', () => {
    const data = makeRouteFact()
    delete (data as unknown as Record<string, unknown>).effectiveMerchantCategory
    expect(isRouteFactRuleData(data)).toBe(false)
  })

  it('rejects non-boolean capGoverned', () => {
    expect(isRouteFactRuleData({ ...makeRouteFact(), capGoverned: 'yes' })).toBe(false)
  })
})

// --- validator ---

describe('validateRouteFactRuleData', () => {
  it('passes a valid route-fact', () => {
    expect(validateRouteFactRuleData(makeRouteFact())).toEqual({ ok: true })
  })

  it('rejects empty effectiveMerchantCategory', () => {
    const result = validateRouteFactRuleData(makeRouteFact({ effectiveMerchantCategory: '' }))
    expect(result.ok).toBe(false)
  })

  it('rejects negative pointsPerDollar', () => {
    const result = validateRouteFactRuleData(makeRouteFact({ pointsPerDollar: -1 }))
    expect(result.ok).toBe(false)
  })

  it('rejects non-integer capPoints', () => {
    const result = validateRouteFactRuleData(makeRouteFact({ capPoints: 1.5 }))
    expect(result.ok).toBe(false)
  })

  it('accepts null capPoints', () => {
    expect(validateRouteFactRuleData(makeRouteFact({ capPoints: null }))).toEqual({ ok: true })
  })

  it('accepts negative voucherFeeCents (discount)', () => {
    expect(validateRouteFactRuleData(makeRouteFact({ voucherFeeCents: -500 }))).toEqual({ ok: true })
  })
})

// --- publish-eligibility by evidence status (ADR 0003) ---

describe('publish-eligibility by evidence status', () => {
  it('officially-documented evidence is publishable', () => {
    expect(validateEvidenceStandard('officially-documented')).toEqual({ ok: true })
  })

  it('statement-verified evidence is publishable', () => {
    expect(validateEvidenceStandard('statement-verified')).toEqual({ ok: true })
  })

  it('inferred evidence is NOT publishable (Data Lead only)', () => {
    const result = validateEvidenceStandard('inferred')
    expect(result.ok).toBe(false)
  })

  it('community-reported evidence is NOT publishable (Data Lead only)', () => {
    const result = validateEvidenceStandard('community-reported')
    expect(result.ok).toBe(false)
  })
})

// --- excluded-MCC-zeroes-the-leg ---

describe('excluded MCC zeroes the voucher-purchase leg', () => {
  it('voucher MCC not in exclusions → earns rewards', () => {
    const routeFact = makeRouteFact({
      effectiveMerchantCategory: 'gift-card',
      exclusions: ['fuel', 'wallet-load'],
      pointsPerDollar: 0.05,
    })
    const engineRule = routeFactToEngineRule(routeFact, makeEnvelope())
    const context = makeContext({ merchantCategory: routeFact.effectiveMerchantCategory })

    const result = calculate(context, [engineRule])

    expect(result.rewardsEarned).toBeGreaterThan(0)
    expect(result.ruleApplied).toBe('rv-route-1')
  })

  it('voucher MCC in card exclusions → zero rewards', () => {
    const routeFact = makeRouteFact({
      effectiveMerchantCategory: 'wallet-load',
      exclusions: ['wallet-load', 'fuel'],
      pointsPerDollar: 0.05,
    })
    const engineRule = routeFactToEngineRule(routeFact, makeEnvelope())
    const context = makeContext({ merchantCategory: routeFact.effectiveMerchantCategory })

    const result = calculate(context, [engineRule])

    expect(result.rewardsEarned).toBe(0)
    expect(result.ruleApplied).toBeNull()
  })

  it('gift-card MCC excluded by premium card → zero rewards', () => {
    const routeFact = makeRouteFact({
      effectiveMerchantCategory: 'gift-card',
      exclusions: ['fuel', 'wallet-load', 'gift-card'],
      pointsPerDollar: 0.033333,
    })
    const engineRule = routeFactToEngineRule(routeFact, makeEnvelope())
    const context = makeContext({ merchantCategory: 'gift-card' })

    const result = calculate(context, [engineRule])

    expect(result.rewardsEarned).toBe(0)
    expect(result.ruleApplied).toBeNull()
  })

  it('cap is applied to the voucher leg when present', () => {
    const routeFact = makeRouteFact({
      effectiveMerchantCategory: 'gift-card',
      exclusions: [],
      pointsPerDollar: 0.05,
      capPoints: 10,
    })
    const engineRule = routeFactToEngineRule(routeFact, makeEnvelope())
    // ₹10,000 at 0.05 ppd = 50 raw, cap = 10
    const context = makeContext({ amount: 1_000_000, merchantCategory: 'gift-card' })

    const result = calculate(context, [engineRule])

    expect(result.rewardsEarned).toBe(10)
  })
})

// --- cap-governed flag round-tripping ---

describe('cap-governed flag round-trips', () => {
  it('capGoverned: false survives type guard', () => {
    const data = makeRouteFact({ capGoverned: false })
    expect(isRouteFactRuleData(data)).toBe(true)
    expect(data.capGoverned).toBe(false)
  })

  it('capGoverned: true survives type guard', () => {
    const data = makeRouteFact({ capGoverned: true })
    expect(isRouteFactRuleData(data)).toBe(true)
    expect(data.capGoverned).toBe(true)
  })

  it('capGoverned round-trips through JSON serialisation (JSONB storage)', () => {
    const original = makeRouteFact({ capGoverned: true })
    const stored = JSON.parse(JSON.stringify(original))
    expect(isRouteFactRuleData(stored)).toBe(true)
    expect(stored.capGoverned).toBe(true)
  })

  it('capGoverned: false round-trips through JSON serialisation', () => {
    const original = makeRouteFact({ capGoverned: false })
    const stored = JSON.parse(JSON.stringify(original))
    expect(isRouteFactRuleData(stored)).toBe(true)
    expect(stored.capGoverned).toBe(false)
  })
})

// --- routeFactToEngineRule projection ---

describe('routeFactToEngineRule', () => {
  it('projects to a direct rule scoped to the effective MCC', () => {
    const routeFact = makeRouteFact({
      effectiveMerchantCategory: 'gift-card',
      exclusions: ['fuel'],
      pointsPerDollar: 0.033333,
      capPoints: 500,
    })
    const envelope = makeEnvelope()
    const rule = routeFactToEngineRule(routeFact, envelope)

    expect(rule.id).toBe(envelope.id)
    expect(rule.cardId).toBe(envelope.cardId)
    expect(rule.effectiveFrom).toBe(envelope.effectiveFrom)
    expect(rule.effectiveTo).toBe(envelope.effectiveTo)
    expect(rule.ruleData).toEqual({
      ruleType: 'direct',
      categories: ['gift-card'],
      exclusions: ['fuel'],
      pointsPerDollar: 0.033333,
      capPoints: 500,
    })
  })

  it('voucherFeeCents and capGoverned are NOT projected into the engine rule (metadata only)', () => {
    const routeFact = makeRouteFact({ voucherFeeCents: 1500, capGoverned: true })
    const rule = routeFactToEngineRule(routeFact, makeEnvelope())

    // These fields are consumed by the composition layer (ticket 03), not the engine
    expect('voucherFeeCents' in rule.ruleData).toBe(false)
    expect('capGoverned' in rule.ruleData).toBe(false)
  })
})

// --- retraction availability ---

describe('retraction works on route-fact rule versions', () => {
  // The existing retraction validators are shape-agnostic; they only check retracted_at.
  // Import from retract.ts to prove the point.
  it('validates an unretracted route-fact rule version for retraction', async () => {
    const { validateRuleVersionForRetraction } = await import('../admin/retract')
    expect(validateRuleVersionForRetraction({ retracted_at: null })).toEqual({ ok: true })
  })

  it('rejects an already-retracted route-fact rule version', async () => {
    const { validateRuleVersionForRetraction } = await import('../admin/retract')
    const result = validateRuleVersionForRetraction({ retracted_at: '2026-09-01T00:00:00Z' })
    expect(result.ok).toBe(false)
  })
})
