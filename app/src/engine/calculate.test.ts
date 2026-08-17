import { describe, it, expect } from 'vitest'
import { calculate } from './calculate'
import type { TransactionContext, RuleVersion } from './types'

function makeContext(overrides: Partial<TransactionContext> = {}): TransactionContext {
  return {
    transactionId: 'txn-1',
    amount: 5000,
    merchantCategory: 'dining',
    merchantName: 'Test Restaurant',
    transactionDate: '2024-06-15',
    ...overrides,
  }
}

function makeRule(
  id: string,
  overrides: {
    categories?: string[]
    exclusions?: string[]
    pointsPerDollar?: number
    capPoints?: number | null
    effectiveFrom?: string
    effectiveTo?: string | null
    cardId?: string
  } = {}
): RuleVersion {
  return {
    id,
    cardId: overrides.cardId ?? 'card-1',
    effectiveFrom: overrides.effectiveFrom ?? '2024-01-01',
    effectiveTo: overrides.effectiveTo !== undefined ? overrides.effectiveTo : null,
    ruleData: {
      ruleType: 'direct',
      categories: overrides.categories ?? [],
      exclusions: overrides.exclusions ?? [],
      pointsPerDollar: overrides.pointsPerDollar ?? 1,
      capPoints: overrides.capPoints !== undefined ? overrides.capPoints : null,
    },
  }
}

// --- golden dataset ---

describe('golden dataset', () => {
  it('GD-01: dining 3x earns correct points', () => {
    const outcome = calculate(
      makeContext({ amount: 5000, merchantCategory: 'dining' }),
      [makeRule('r1', { categories: ['dining'], pointsPerDollar: 3 })]
    )
    expect(outcome.rewardsEarned).toBe(150)
    expect(outcome.ruleApplied).toBe('r1')
  })

  it('GD-02: travel 2x earns correct points', () => {
    const outcome = calculate(
      makeContext({ amount: 20000, merchantCategory: 'travel' }),
      [makeRule('r1', { categories: ['travel'], pointsPerDollar: 2 })]
    )
    expect(outcome.rewardsEarned).toBe(400)
    expect(outcome.ruleApplied).toBe('r1')
  })

  it('GD-03: base 1x earn rate for unmatched category', () => {
    const outcome = calculate(
      makeContext({ amount: 3000, merchantCategory: 'groceries' }),
      [makeRule('base', { categories: [], pointsPerDollar: 1 })]
    )
    expect(outcome.rewardsEarned).toBe(30)
    expect(outcome.ruleApplied).toBe('base')
  })

  it('GD-04: cap limits points earned', () => {
    const outcome = calculate(
      makeContext({ amount: 100000, merchantCategory: 'dining' }),
      [makeRule('r1', { categories: ['dining'], pointsPerDollar: 3, capPoints: 1000 })]
    )
    expect(outcome.rewardsEarned).toBe(1000)
  })

  it('GD-05: excluded category falls back to base rate', () => {
    const outcome = calculate(
      makeContext({ amount: 5000, merchantCategory: 'dining' }),
      [
        makeRule('bonus', { categories: [], exclusions: ['dining'], pointsPerDollar: 2 }),
        makeRule('base', { categories: [], pointsPerDollar: 1 }),
      ]
    )
    expect(outcome.rewardsEarned).toBe(50)
    expect(outcome.ruleApplied).toBe('base')
  })

  it('GD-06: rule not yet effective earns 0 points', () => {
    const outcome = calculate(
      makeContext({ transactionDate: '2024-01-01' }),
      [makeRule('r1', { effectiveFrom: '2024-06-01', pointsPerDollar: 3 })]
    )
    expect(outcome.rewardsEarned).toBe(0)
    expect(outcome.ruleApplied).toBeNull()
  })

  it('GD-07: best rule wins when multiple rules match', () => {
    const outcome = calculate(
      makeContext({ amount: 10000, merchantCategory: 'dining' }),
      [
        makeRule('r2x', { categories: ['dining'], pointsPerDollar: 2 }),
        makeRule('r3x', { categories: ['dining'], pointsPerDollar: 3 }),
      ]
    )
    expect(outcome.rewardsEarned).toBe(300)
    expect(outcome.ruleApplied).toBe('r3x')
  })

  it('GD-08: fractional dollars are floored', () => {
    // $1.50 (150 cents) at 1x = floor(1.5) = 1 point
    const outcome = calculate(
      makeContext({ amount: 150, merchantCategory: 'other' }),
      [makeRule('base', { categories: [], pointsPerDollar: 1 })]
    )
    expect(outcome.rewardsEarned).toBe(1)
  })

  it('GD-09: zero amount applies rule but earns 0 points', () => {
    const outcome = calculate(
      makeContext({ amount: 0, merchantCategory: 'dining' }),
      [makeRule('r1', { categories: ['dining'], pointsPerDollar: 5 })]
    )
    expect(outcome.rewardsEarned).toBe(0)
    expect(outcome.ruleApplied).toBe('r1')
  })

  it('GD-10: expired rule does not match', () => {
    const outcome = calculate(
      makeContext({ transactionDate: '2024-01-01' }),
      [makeRule('r1', { effectiveTo: '2023-12-31', categories: [], pointsPerDollar: 3 })]
    )
    expect(outcome.rewardsEarned).toBe(0)
    expect(outcome.ruleApplied).toBeNull()
  })
})

// --- earn rate ---

describe('earn rate', () => {
  it.each([
    [10000, 1, 100],
    [10000, 3, 300],
    [10001, 3, 300], // $100.01 × 3 = 300.03 → 300
    [999, 1, 9],     // $9.99 at 1x = 9 points
    [50, 2, 1],      // $0.50 at 2x = 1 point
  ])('amount=%i rate=%i → %i points', (amount, rate, expected) => {
    const outcome = calculate(
      makeContext({ amount, merchantCategory: 'dining' }),
      [makeRule('r1', { categories: ['dining'], pointsPerDollar: rate })]
    )
    expect(outcome.rewardsEarned).toBe(expected)
  })
})

// --- cap ---

describe('cap', () => {
  it('applies cap when uncapped points exceed it', () => {
    const outcome = calculate(
      makeContext({ amount: 50000 }),
      [makeRule('r1', { categories: ['dining'], pointsPerDollar: 3, capPoints: 100 })]
    )
    expect(outcome.rewardsEarned).toBe(100)
  })

  it('does not cap when points are below cap', () => {
    const outcome = calculate(
      makeContext({ amount: 1000 }),
      [makeRule('r1', { categories: ['dining'], pointsPerDollar: 3, capPoints: 100 })]
    )
    expect(outcome.rewardsEarned).toBe(30)
  })

  it('null cap means no limit', () => {
    const outcome = calculate(
      makeContext({ amount: 1000000 }),
      [makeRule('r1', { categories: ['dining'], pointsPerDollar: 3, capPoints: null })]
    )
    expect(outcome.rewardsEarned).toBe(30000)
  })

  it('trace records cap assumption when cap fires', () => {
    const outcome = calculate(
      makeContext({ amount: 50000 }),
      [makeRule('r1', { categories: ['dining'], pointsPerDollar: 3, capPoints: 100 })]
    )
    const entry = outcome.trace.entries[0]
    expect(entry.assumptions.some(a => a.includes('capped'))).toBe(true)
  })
})

// --- exclusions ---

describe('exclusions', () => {
  it('excluded category does not match the rule', () => {
    const outcome = calculate(
      makeContext({ merchantCategory: 'dining' }),
      [makeRule('r1', { categories: [], exclusions: ['dining'], pointsPerDollar: 3 })]
    )
    expect(outcome.ruleApplied).toBeNull()
    expect(outcome.rewardsEarned).toBe(0)
  })

  it('non-excluded category still matches base rule', () => {
    const outcome = calculate(
      makeContext({ merchantCategory: 'travel' }),
      [makeRule('r1', { categories: [], exclusions: ['dining'], pointsPerDollar: 3 })]
    )
    expect(outcome.rewardsEarned).toBe(150)
  })
})

// --- calculation trace ---

describe('calculation trace', () => {
  it('lists every evaluated rule', () => {
    const outcome = calculate(
      makeContext(),
      [
        makeRule('r1', { categories: ['dining'], pointsPerDollar: 3 }),
        makeRule('r2', { categories: ['travel'], pointsPerDollar: 2 }),
      ]
    )
    expect(outcome.trace.entries).toHaveLength(2)
    expect(outcome.trace.entries.map(e => e.ruleId)).toContain('r1')
    expect(outcome.trace.entries.map(e => e.ruleId)).toContain('r2')
  })

  it('exactly one applied entry when a rule matches', () => {
    const outcome = calculate(
      makeContext(),
      [
        makeRule('r1', { categories: ['dining'], pointsPerDollar: 3 }),
        makeRule('r2', { categories: [], pointsPerDollar: 1 }),
      ]
    )
    const applied = outcome.trace.entries.filter(e => e.applied)
    expect(applied).toHaveLength(1)
    expect(applied[0].ruleId).toBe('r1')
  })

  it('records all inputs per rule entry', () => {
    const outcome = calculate(
      makeContext({ amount: 5000, merchantCategory: 'dining' }),
      [makeRule('r1', { categories: ['dining'], pointsPerDollar: 3 })]
    )
    const entry = outcome.trace.entries[0]
    expect(entry.inputs.amount).toBe(5000)
    expect(entry.inputs.merchantCategory).toBe('dining')
    expect(entry.inputs.pointsPerDollar).toBe(3)
    expect(entry.inputs.categories).toEqual(['dining'])
  })

  it('records base rate assumption', () => {
    const outcome = calculate(
      makeContext({ merchantCategory: 'other' }),
      [makeRule('base', { categories: [], pointsPerDollar: 1 })]
    )
    const entry = outcome.trace.entries[0]
    expect(entry.assumptions.some(a => a.includes('base earn rate'))).toBe(true)
  })

  it('trace transactionId matches context', () => {
    const outcome = calculate(makeContext({ transactionId: 'txn-abc' }), [])
    expect(outcome.trace.transactionId).toBe('txn-abc')
  })

  it('no entry has evaluated field', () => {
    const outcome = calculate(makeContext(), [makeRule('r1', { categories: ['dining'] })])
    expect('evaluated' in outcome.trace.entries[0]).toBe(false)
  })

  it('non-matching entries have applied=false', () => {
    const outcome = calculate(
      makeContext({ merchantCategory: 'dining' }),
      [
        makeRule('r1', { categories: ['dining'], pointsPerDollar: 3 }),
        makeRule('r2', { categories: ['travel'], pointsPerDollar: 2 }),
      ]
    )
    const notApplied = outcome.trace.entries.find(e => e.ruleId === 'r2')
    expect(notApplied?.applied).toBe(false)
  })
})

// --- fee scenarios ---

describe('fee scenarios', () => {
  it('fee transaction excluded from bonus rule earns 0', () => {
    const outcome = calculate(
      makeContext({ merchantCategory: 'fee' }),
      [makeRule('r1', { categories: [], exclusions: ['fee'], pointsPerDollar: 3 })]
    )
    expect(outcome.rewardsEarned).toBe(0)
    expect(outcome.ruleApplied).toBeNull()
  })

  it('fee transaction matches base rule when not excluded', () => {
    const outcome = calculate(
      makeContext({ amount: 9500, merchantCategory: 'fee' }),
      [makeRule('base', { categories: [], pointsPerDollar: 1 })]
    )
    expect(outcome.rewardsEarned).toBe(95)
    expect(outcome.ruleApplied).toBe('base')
  })

  it('fee excluded from high-earn rule falls back to base rate', () => {
    const outcome = calculate(
      makeContext({ amount: 5000, merchantCategory: 'fee' }),
      [
        makeRule('bonus', { categories: [], exclusions: ['fee'], pointsPerDollar: 3 }),
        makeRule('base', { categories: [], pointsPerDollar: 1 }),
      ]
    )
    expect(outcome.rewardsEarned).toBe(50)
    expect(outcome.ruleApplied).toBe('base')
  })
})

// --- edge cases ---

describe('no rules', () => {
  it('returns 0 rewards and null ruleApplied', () => {
    const outcome = calculate(makeContext(), [])
    expect(outcome.rewardsEarned).toBe(0)
    expect(outcome.ruleApplied).toBeNull()
    expect(outcome.trace.entries).toHaveLength(0)
  })
})

describe('determinism', () => {
  it('same inputs always produce identical output', () => {
    const ctx = makeContext({ amount: 7777, merchantCategory: 'travel' })
    const rules = [
      makeRule('r1', { categories: ['travel'], pointsPerDollar: 2 }),
      makeRule('r2', { categories: [], pointsPerDollar: 1 }),
    ]
    expect(calculate(ctx, rules)).toEqual(calculate(ctx, rules))
  })
})
