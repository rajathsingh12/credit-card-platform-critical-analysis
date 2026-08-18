import { describe, it, expect } from 'vitest'
import { calculate } from './calculate'
import type { TransactionContext, TransactionOutcome, UnresolvedOutcome } from './types'
import {
  VERIFIED_CARD_SET,
  findSeedCard,
  toRuleVersion,
  toRedemptionScenarios,
  cardKey,
  SEED_EFFECTIVE_FROM,
  type SeedCard,
} from '../catalog/verified-card-set'

const TXN_DATE = '2026-08-18'

function txn(overrides: Partial<TransactionContext> = {}): TransactionContext {
  return {
    transactionId: 'txn-1',
    amount: 100_000,
    merchantCategory: 'dining',
    merchantName: 'Test Merchant',
    transactionDate: TXN_DATE,
    ...overrides,
  }
}

function run(spec: SeedCard, context: TransactionContext) {
  return calculate(context, [toRuleVersion(spec)], toRedemptionScenarios(spec))
}

describe('golden dataset: cash-back cards', () => {
  it('pays 1% on HDFC Bank Millennia for a Rs 2,500 dining spend', () => {
    const spec = findSeedCard('HDFC Bank', 'Millennia')
    const result = run(spec, txn({ amount: 250_000, merchantCategory: 'dining' }))

    expect(result.resolved).toBe(true)
    const outcome = result as TransactionOutcome
    expect(outcome.rewardsEarned).toBe(2_500)
    expect(outcome.ruleApplied).toBe(`rv::${cardKey(spec)}`)
    expect(outcome.scenarioApplied).toBeNull()
    expect(outcome.netReturnCents).toBeNull()
    expect(outcome.annualFeeAmortizedCents).toBeNull()
  })

  it('pays 1.5% on Axis Bank ACE for a Rs 4,000 grocery spend', () => {
    const spec = findSeedCard('Axis Bank', 'ACE')
    const result = run(spec, txn({ amount: 400_000, merchantCategory: 'grocery' }))

    expect((result as TransactionOutcome).rewardsEarned).toBe(6_000)
  })

  it('pays nothing on an excluded category', () => {
    const spec = findSeedCard('HDFC Bank', 'Millennia')
    const result = run(spec, txn({ amount: 300_000, merchantCategory: 'fuel' }))

    const outcome = result as TransactionOutcome
    expect(outcome.rewardsEarned).toBe(0)
    expect(outcome.ruleApplied).toBeNull()
    expect(outcome.trace.entries[0].reason).toContain('excluded')
  })

  it('applies the rule to a zero-value transaction and earns nothing', () => {
    const spec = findSeedCard('HDFC Bank', 'Millennia')
    const outcome = run(spec, txn({ amount: 0 })) as TransactionOutcome

    expect(outcome.rewardsEarned).toBe(0)
    expect(outcome.ruleApplied).toBe(`rv::${cardKey(spec)}`)
  })

  it('earns nothing before the rule takes effect', () => {
    const spec = findSeedCard('HDFC Bank', 'Millennia')
    const outcome = run(
      spec,
      txn({ amount: 250_000, transactionDate: '2024-12-31' })
    ) as TransactionOutcome

    expect(outcome.rewardsEarned).toBe(0)
    expect(outcome.ruleApplied).toBeNull()
  })
})

describe('golden dataset: caps', () => {
  it('caps HDFC Bank MoneyBack+ at 2,000 points and nets the fee out', () => {
    const spec = findSeedCard('HDFC Bank', 'MoneyBack+')
    const outcome = run(
      spec,
      txn({ amount: 20_000_000, merchantCategory: 'online' })
    ) as TransactionOutcome

    // 0.02 points per rupee on Rs 2,00,000 would earn 4,000 points; the cap holds it at 2,000.
    expect(outcome.rewardsEarned).toBe(2_000)
    expect(outcome.scenarioApplied).toBe(`rs::${cardKey(spec)}::travel-portal`)
    expect(outcome.annualFeeAmortizedCents).toBe(4_167)
    expect(outcome.netReturnCents).toBe(45_833)

    const applied = outcome.trace.entries.find(e => e.applied)
    expect(applied?.pointsBeforeCap).toBe(4_000)
    expect(applied?.pointsAfterCap).toBe(2_000)
  })
})

describe('golden dataset: redemption scenario selection', () => {
  it('picks the travel scenario for Amex Platinum Travel and breaks even against the fee', () => {
    const spec = findSeedCard('American Express', 'Platinum Travel Credit Card')
    const outcome = run(
      spec,
      txn({ amount: 5_000_000, merchantCategory: 'travel' })
    ) as TransactionOutcome

    expect(outcome.rewardsEarned).toBe(1_000)
    expect(outcome.scenarioApplied).toBe(`rs::${cardKey(spec)}::membership-rewards-travel`)
    expect(outcome.annualFeeAmortizedCents).toBe(50_000)
    expect(outcome.netReturnCents).toBe(0)
  })

  it('falls back to the statement-credit scenario off travel, and reports a negative net return', () => {
    const spec = findSeedCard('American Express', 'Platinum Travel Credit Card')
    const outcome = run(
      spec,
      txn({ amount: 5_000_000, merchantCategory: 'dining' })
    ) as TransactionOutcome

    expect(outcome.rewardsEarned).toBe(1_000)
    expect(outcome.scenarioApplied).toBe(`rs::${cardKey(spec)}::membership-rewards-statement`)
    expect(outcome.netReturnCents).toBe(-25_000)
  })

  it('reports an Unresolved Outcome when no scenario covers the transaction', () => {
    const spec = findSeedCard('Standard Chartered', 'Ultimate')
    const result = calculate(
      txn({ amount: 1_000_000, merchantCategory: 'dining' }),
      [toRuleVersion(spec)],
      []
    )

    expect(result.resolved).toBe(false)
    const unresolved = result as UnresolvedOutcome
    expect(unresolved.rewardsEarned).toBe(500)
    expect(unresolved.reason).toBe('no Redemption Scenario covers this transaction')
  })
})

const PROBE_CATEGORIES = ['dining', 'travel', 'grocery', 'online', 'entertainment']
const PROBE_AMOUNTS = [100_000, 2_500_000]

type Probe = { spec: SeedCard; context: TransactionContext }

const PROBES: Probe[] = VERIFIED_CARD_SET.flatMap(spec =>
  PROBE_CATEGORIES.flatMap(merchantCategory =>
    PROBE_AMOUNTS.map(amount => ({
      spec,
      context: txn({
        transactionId: `${cardKey(spec)}|${merchantCategory}|${amount}`,
        amount,
        merchantCategory,
      }),
    }))
  )
)

function label(probe: Probe): string {
  return `${probe.spec.issuer} ${probe.spec.name} @ ${probe.context.merchantCategory} ${probe.context.amount}`
}

describe('Critical Calculation Errors across the Verified Card Set', () => {
  it('probes every card on ordinary spend', () => {
    expect(PROBES.length).toBe(
      VERIFIED_CARD_SET.length * PROBE_CATEGORIES.length * PROBE_AMOUNTS.length
    )
  })

  it('never leaves ordinary spend unresolved', () => {
    const unresolved = PROBES.filter(p => !run(p.spec, p.context).resolved).map(label)
    expect(unresolved).toEqual([])
  })

  it('always applies the published rule to non-excluded spend', () => {
    const unapplied = PROBES.filter(p => {
      const result = run(p.spec, p.context) as TransactionOutcome
      return result.ruleApplied === null
    }).map(label)
    expect(unapplied).toEqual([])
  })

  it('earns a whole, non-negative number of points everywhere', () => {
    const bad = PROBES.filter(p => {
      const { rewardsEarned } = run(p.spec, p.context)
      return !Number.isInteger(rewardsEarned) || rewardsEarned < 0
    }).map(label)
    expect(bad).toEqual([])
  })

  it('never earns more than the declared cap', () => {
    const overCap = PROBES.filter(p => {
      const cap = p.spec.ruleData.capPoints
      if (cap === null) return false
      return run(p.spec, p.context).rewardsEarned > cap
    }).map(label)
    expect(overCap).toEqual([])
  })

  it('amortizes each annual fee as one twelfth of the fee stated on the card', () => {
    const wrong = PROBES.filter(p => {
      const result = run(p.spec, p.context) as TransactionOutcome
      if (result.annualFeeAmortizedCents === null) return p.spec.annualFeeCents !== null && result.scenarioApplied !== null
      const expected = Math.round((p.spec.annualFeeCents ?? 0) / 12)
      return result.annualFeeAmortizedCents !== expected
    }).map(label)
    expect(wrong).toEqual([])
  })

  it('states a net return in whole minor units wherever it states one at all', () => {
    const bad = PROBES.filter(p => {
      const result = run(p.spec, p.context) as TransactionOutcome
      return result.netReturnCents !== null && !Number.isInteger(result.netReturnCents)
    }).map(label)
    expect(bad).toEqual([])
  })

  it('cites a redemption scenario for every variable-reward outcome', () => {
    const uncited = PROBES.filter(p => {
      if (p.spec.ruleData.ruleType !== 'variable') return false
      const result = run(p.spec, p.context) as TransactionOutcome
      return result.scenarioApplied === null
    }).map(label)
    expect(uncited).toEqual([])
  })

  it('records a trace entry for the published rule on every probe', () => {
    const untraced = PROBES.filter(p => run(p.spec, p.context).trace.entries.length === 0).map(label)
    expect(untraced).toEqual([])
  })

  it('discloses the base-rate assumption on every applied rule', () => {
    const undisclosed = PROBES.filter(p => {
      const applied = run(p.spec, p.context).trace.entries.find(e => e.applied)
      return !applied?.assumptions.some(a => a.includes('base earn rate applies'))
    }).map(label)
    expect(undisclosed).toEqual([])
  })
})

describe('excluded spend across the Verified Card Set', () => {
  it('earns nothing and applies no rule on every declared exclusion', () => {
    const violations = VERIFIED_CARD_SET.flatMap(spec =>
      spec.ruleData.exclusions.map(category => {
        const result = run(spec, txn({ amount: 500_000, merchantCategory: category }))
        const ok = result.resolved && result.rewardsEarned === 0 && result.ruleApplied === null
        return ok ? null : `${spec.issuer} ${spec.name} @ ${category}`
      })
    ).filter(Boolean)
    expect(violations).toEqual([])
  })
})

describe('published rule effectivity', () => {
  it('is effective on the probe date for every card', () => {
    const notEffective = VERIFIED_CARD_SET.filter(spec => {
      const rule = toRuleVersion(spec)
      return !(rule.effectiveFrom <= TXN_DATE && rule.effectiveTo === null)
    }).map(spec => `${spec.issuer} ${spec.name}`)
    expect(notEffective).toEqual([])
  })

  it('starts on the seeded effective date', () => {
    const wrongStart = VERIFIED_CARD_SET.filter(
      spec => toRuleVersion(spec).effectiveFrom !== SEED_EFFECTIVE_FROM
    ).map(spec => `${spec.issuer} ${spec.name}`)
    expect(wrongStart).toEqual([])
  })
})
