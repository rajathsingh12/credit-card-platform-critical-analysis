import { describe, it, expect } from 'vitest'
import { calculate } from './calculate'
import type { TransactionContext, RuleVersion, RedemptionScenario } from './types'

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

function makeVariableRule(
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
    effectiveTo: overrides.effectiveTo ?? null,
    ruleData: {
      ruleType: 'variable',
      categories: overrides.categories ?? [],
      exclusions: overrides.exclusions ?? [],
      pointsPerDollar: overrides.pointsPerDollar ?? 1,
      capPoints: overrides.capPoints !== undefined ? overrides.capPoints : null,
    },
  }
}

function makeScenario(
  id: string,
  overrides: {
    redemptionType?: string
    applicableCategories?: string[]
    effectiveFrom?: string
    effectiveTo?: string | null
    centsPerPoint?: number
    annualFeeCents?: number | null
    cardId?: string
  } = {}
): RedemptionScenario {
  return {
    id,
    cardId: overrides.cardId ?? 'card-1',
    redemptionType: overrides.redemptionType ?? 'travel',
    applicableCategories: overrides.applicableCategories ?? [],
    effectiveFrom: overrides.effectiveFrom ?? '2024-01-01',
    effectiveTo: overrides.effectiveTo ?? null,
    centsPerPoint: overrides.centsPerPoint ?? 1.0,
    annualFeeCents: overrides.annualFeeCents !== undefined ? overrides.annualFeeCents : null,
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

  it('records ruleEffectiveFrom in every trace entry', () => {
    const outcome = calculate(
      makeContext(),
      [makeRule('r1', { effectiveFrom: '2024-03-15', categories: ['dining'] })]
    )
    expect(outcome.trace.entries[0].ruleEffectiveFrom).toBe('2024-03-15')
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

// --- variable rewards golden dataset ---

describe('variable rewards — golden dataset', () => {
  it('VGD-01: variable rule with scenario earns correct points and net return', () => {
    // $100 at 3x = 300 points; 1.5 cpp → 450 cents
    const outcome = calculate(
      makeContext({ amount: 10000, merchantCategory: 'dining' }),
      [makeVariableRule('r1', { categories: ['dining'], pointsPerDollar: 3 })],
      [makeScenario('s1', { centsPerPoint: 1.5 })]
    )
    expect(outcome.resolved).toBe(true)
    if (outcome.resolved) {
      expect(outcome.rewardsEarned).toBe(300)
      expect(outcome.scenarioApplied).toBe('s1')
      expect(outcome.netReturnCents).toBe(450)
    }
  })

  it('VGD-02: variable rule with no scenarios returns UnresolvedOutcome', () => {
    const outcome = calculate(
      makeContext({ amount: 10000, merchantCategory: 'dining' }),
      [makeVariableRule('r1', { categories: ['dining'], pointsPerDollar: 3 })]
    )
    expect(outcome.resolved).toBe(false)
    if (!outcome.resolved) {
      expect(outcome.ruleApplied).toBe('r1')
      expect(outcome.rewardsEarned).toBe(300)
      expect(outcome.reason).toContain('Redemption Scenario')
    }
  })

  it('VGD-03: variable rule cap limits points; scenario applied to capped value', () => {
    // $500 at 3x = 1500 raw, cap=200; 2.0 cpp → 400 cents
    const outcome = calculate(
      makeContext({ amount: 50000, merchantCategory: 'dining' }),
      [makeVariableRule('r1', { categories: ['dining'], pointsPerDollar: 3, capPoints: 200 })],
      [makeScenario('s1', { centsPerPoint: 2.0 })]
    )
    expect(outcome.resolved).toBe(true)
    if (outcome.resolved) {
      expect(outcome.rewardsEarned).toBe(200)
      expect(outcome.netReturnCents).toBe(400)
    }
  })

  it('VGD-04: exclusion on variable rule prevents match; outcome is resolved with 0 points', () => {
    const outcome = calculate(
      makeContext({ amount: 5000, merchantCategory: 'dining' }),
      [makeVariableRule('r1', { exclusions: ['dining'], pointsPerDollar: 3 })],
      [makeScenario('s1')]
    )
    expect(outcome.resolved).toBe(true)
    expect(outcome.rewardsEarned).toBe(0)
    expect(outcome.ruleApplied).toBeNull()
  })

  it('VGD-05: annual fee amortized over 12 months in outcome', () => {
    // $95/year = 9500 cents; 9500 / 12 = 791.67 → rounds to 792
    const outcome = calculate(
      makeContext({ amount: 10000, merchantCategory: 'dining' }),
      [makeVariableRule('r1', { categories: ['dining'], pointsPerDollar: 1 })],
      [makeScenario('s1', { centsPerPoint: 1.0, annualFeeCents: 9500 })]
    )
    expect(outcome.resolved).toBe(true)
    if (outcome.resolved) {
      expect(outcome.annualFeeAmortizedCents).toBe(792)
    }
  })

  it('VGD-06: expired scenario returns UnresolvedOutcome', () => {
    const outcome = calculate(
      makeContext({ transactionDate: '2024-06-15', merchantCategory: 'dining' }),
      [makeVariableRule('r1', { categories: ['dining'], pointsPerDollar: 2 })],
      [makeScenario('s1', { effectiveTo: '2023-12-31', centsPerPoint: 1.5 })]
    )
    expect(outcome.resolved).toBe(false)
  })

  it('VGD-07: variable rule not yet effective; no match; resolved with 0 points', () => {
    const outcome = calculate(
      makeContext({ transactionDate: '2024-01-01' }),
      [makeVariableRule('r1', { effectiveFrom: '2024-06-01', pointsPerDollar: 3 })],
      [makeScenario('s1')]
    )
    expect(outcome.resolved).toBe(true)
    expect(outcome.rewardsEarned).toBe(0)
    expect(outcome.ruleApplied).toBeNull()
  })
})

// --- scenario selection ---

describe('scenario selection', () => {
  it('category-specific scenario beats general when both effective', () => {
    const outcome = calculate(
      makeContext({ amount: 10000, merchantCategory: 'travel' }),
      [makeVariableRule('r1', { pointsPerDollar: 1 })],
      [
        makeScenario('general', { applicableCategories: [], centsPerPoint: 1.0 }),
        makeScenario('specific', { applicableCategories: ['travel'], centsPerPoint: 2.0 }),
      ]
    )
    expect(outcome.resolved).toBe(true)
    if (outcome.resolved) {
      expect(outcome.scenarioApplied).toBe('specific')
      expect(outcome.netReturnCents).toBe(200)
    }
  })

  it('highest centsPerPoint wins among same-specificity scenarios', () => {
    const outcome = calculate(
      makeContext({ amount: 10000, merchantCategory: 'dining' }),
      [makeVariableRule('r1', { pointsPerDollar: 1 })],
      [
        makeScenario('low', { centsPerPoint: 1.0 }),
        makeScenario('high', { centsPerPoint: 1.5 }),
      ]
    )
    expect(outcome.resolved).toBe(true)
    if (outcome.resolved) {
      expect(outcome.scenarioApplied).toBe('high')
    }
  })

  it('category-specific scenario for wrong category falls back to general', () => {
    const outcome = calculate(
      makeContext({ amount: 10000, merchantCategory: 'groceries' }),
      [makeVariableRule('r1', { pointsPerDollar: 1 })],
      [
        makeScenario('travel-specific', { applicableCategories: ['travel'], centsPerPoint: 3.0 }),
        makeScenario('general', { applicableCategories: [], centsPerPoint: 1.0 }),
      ]
    )
    expect(outcome.resolved).toBe(true)
    if (outcome.resolved) {
      expect(outcome.scenarioApplied).toBe('general')
    }
  })

  it('only category-specific scenarios with no general → UnresolvedOutcome when category unmatched', () => {
    const outcome = calculate(
      makeContext({ merchantCategory: 'groceries' }),
      [makeVariableRule('r1', { pointsPerDollar: 1 })],
      [makeScenario('travel-only', { applicableCategories: ['travel'], centsPerPoint: 2.0 })]
    )
    expect(outcome.resolved).toBe(false)
  })

  it('effectiveTo boundary date is inclusive', () => {
    const outcome = calculate(
      makeContext({ transactionDate: '2024-12-31' }),
      [makeVariableRule('r1', { pointsPerDollar: 1 })],
      [makeScenario('s1', { effectiveTo: '2024-12-31', centsPerPoint: 1.0 })]
    )
    expect(outcome.resolved).toBe(true)
  })

  it('records tie-break assumption when multiple scenarios cover the transaction', () => {
    const outcome = calculate(
      makeContext({ amount: 10000, merchantCategory: 'dining' }),
      [makeVariableRule('r1', { pointsPerDollar: 1 })],
      [
        makeScenario('low', { centsPerPoint: 1.0 }),
        makeScenario('high', { centsPerPoint: 1.5 }),
      ]
    )
    expect(outcome.resolved).toBe(true)
    const applied = outcome.trace.entries.find(e => e.applied)
    expect(applied?.assumptions.some(a =>
      a.includes('selected scenario high') &&
      a.includes('highest centsPerPoint (1.5)') &&
      a.includes('among 2 covering scenarios')
    )).toBe(true)
  })

  it('does not record tie-break assumption when only one scenario covers', () => {
    const outcome = calculate(
      makeContext({ amount: 10000, merchantCategory: 'dining' }),
      [makeVariableRule('r1', { pointsPerDollar: 1 })],
      [makeScenario('solo', { centsPerPoint: 1.5 })]
    )
    expect(outcome.resolved).toBe(true)
    const applied = outcome.trace.entries.find(e => e.applied)
    expect(applied?.assumptions.some(a => a.includes('selected scenario'))).toBe(false)
  })
})

// --- net return and fee amortization ---

describe('net return and fee amortization', () => {
  it('null annualFeeCents gives null annualFeeAmortizedCents', () => {
    const outcome = calculate(
      makeContext({ amount: 10000, merchantCategory: 'dining' }),
      [makeVariableRule('r1', { categories: ['dining'], pointsPerDollar: 1 })],
      [makeScenario('s1', { centsPerPoint: 1.5, annualFeeCents: null })]
    )
    expect(outcome.resolved).toBe(true)
    if (outcome.resolved) {
      expect(outcome.annualFeeAmortizedCents).toBeNull()
    }
  })

  it('direct rules yield null netReturnCents and null annualFeeAmortizedCents', () => {
    const outcome = calculate(
      makeContext({ amount: 10000, merchantCategory: 'dining' }),
      [makeRule('r1', { categories: ['dining'], pointsPerDollar: 3 })]
    )
    expect(outcome.resolved).toBe(true)
    if (outcome.resolved) {
      expect(outcome.netReturnCents).toBeNull()
      expect(outcome.annualFeeAmortizedCents).toBeNull()
    }
  })
})

// --- mixed rule sets ---

describe('mixed rule sets', () => {
  it('direct rule wins best-points selection; no scenario needed', () => {
    // direct rule: 400 points; variable rule: 100 points — direct wins
    const outcome = calculate(
      makeContext({ amount: 10000, merchantCategory: 'dining' }),
      [
        makeRule('direct', { categories: ['dining'], pointsPerDollar: 4 }),
        makeVariableRule('variable', { categories: ['dining'], pointsPerDollar: 1 }),
      ],
      [] // no scenarios
    )
    expect(outcome.resolved).toBe(true)
    if (outcome.resolved) {
      expect(outcome.ruleApplied).toBe('direct')
      expect(outcome.rewardsEarned).toBe(400)
    }
  })

  it('variable rule wins best-points selection; UnresolvedOutcome when no scenario even with direct also matched', () => {
    // variable: 500 points; direct: 100 points — variable wins, no scenario → unresolved
    const outcome = calculate(
      makeContext({ amount: 10000, merchantCategory: 'dining' }),
      [
        makeVariableRule('variable', { categories: ['dining'], pointsPerDollar: 5 }),
        makeRule('direct', { categories: ['dining'], pointsPerDollar: 1 }),
      ],
      [] // no scenarios
    )
    expect(outcome.resolved).toBe(false)
    if (!outcome.resolved) {
      expect(outcome.ruleApplied).toBe('variable')
    }
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
