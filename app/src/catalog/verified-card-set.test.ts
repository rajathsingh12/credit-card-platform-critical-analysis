import { describe, it, expect } from 'vitest'
import { VERIFIED_CARD_SET, WITHHELD_CARD_SET, ALL_SEED_CARDS } from './verified-card-set'
import { isPublishable, classifyFeeBand, validateEvidence, ISSUER_DOMAINS } from './evidence'

describe('Verified Card Set coverage', () => {
  it('holds between 30 and 40 cards', () => {
    expect(VERIFIED_CARD_SET.length).toBeGreaterThanOrEqual(30)
    expect(VERIFIED_CARD_SET.length).toBeLessThanOrEqual(40)
  })

  it('covers at least five issuers', () => {
    const issuers = new Set(VERIFIED_CARD_SET.map(c => c.issuer))
    expect(issuers.size).toBeGreaterThanOrEqual(5)
  })

  it('covers at least three reward currencies', () => {
    const currencies = new Set(VERIFIED_CARD_SET.map(c => c.rewardCurrency))
    expect(currencies.size).toBeGreaterThanOrEqual(3)
  })

  it('covers all three fee bands', () => {
    const bands = new Set(VERIFIED_CARD_SET.map(c => classifyFeeBand(c.annualFeeCents)))
    expect(Array.from(bands).sort()).toEqual(['mid-tier', 'no-fee', 'premium'])
  })
})

describe('Verified Card Set evidence', () => {
  it('contains only publishable evidence', () => {
    const weak = VERIFIED_CARD_SET.filter(c => !isPublishable(c.evidenceStatus))
    expect(weak.map(c => `${c.issuer} ${c.name}`)).toEqual([])
  })

  it('passes evidence validation for every card', () => {
    const failures = ALL_SEED_CARDS.map(c => ({
      card: `${c.issuer} ${c.name}`,
      result: validateEvidence({
        issuer: c.issuer,
        evidenceStatus: c.evidenceStatus,
        sourceUrl: c.sourceUrl,
      }),
    })).filter(r => !r.result.ok)
    expect(failures).toEqual([])
  })

  it('names a source document for every card', () => {
    const unnamed = ALL_SEED_CARDS.filter(c => c.sourceName.trim().length === 0)
    expect(unnamed).toEqual([])
  })

  it('knows the official domain of every issuer it seeds', () => {
    const unknown = ALL_SEED_CARDS.map(c => c.issuer).filter(i => !(i in ISSUER_DOMAINS))
    expect(unknown).toEqual([])
  })
})

describe('withheld cards', () => {
  it('is non-empty, so the gate is exercised against weak evidence', () => {
    expect(WITHHELD_CARD_SET.length).toBeGreaterThan(0)
  })

  it('contains only evidence that fails the standard', () => {
    const publishable = WITHHELD_CARD_SET.filter(c => isPublishable(c.evidenceStatus))
    expect(publishable.map(c => `${c.issuer} ${c.name}`)).toEqual([])
  })
})

describe('seed card integrity', () => {
  it('has a unique issuer and name per card', () => {
    const keys = ALL_SEED_CARDS.map(c => `${c.issuer}::${c.name}`)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('publishes a base-rate rule for every card, so ordinary spend never reports zero', () => {
    const scoped = VERIFIED_CARD_SET.filter(c => c.ruleData.categories.length > 0)
    expect(scoped.map(c => `${c.issuer} ${c.name}`)).toEqual([])
  })

  it('earns a positive rate on every card', () => {
    const nonEarning = VERIFIED_CARD_SET.filter(c => c.ruleData.pointsPerDollar <= 0)
    expect(nonEarning.map(c => `${c.issuer} ${c.name}`)).toEqual([])
  })

  it('uses a positive cap where a cap is declared', () => {
    const badCap = VERIFIED_CARD_SET.filter(
      c => c.ruleData.capPoints !== null && c.ruleData.capPoints <= 0
    )
    expect(badCap.map(c => `${c.issuer} ${c.name}`)).toEqual([])
  })

  it('states a whole number of minor currency units for every annual fee', () => {
    const bad = ALL_SEED_CARDS.filter(
      c => c.annualFeeCents !== null && (!Number.isInteger(c.annualFeeCents) || c.annualFeeCents < 0)
    )
    expect(bad.map(c => `${c.issuer} ${c.name}`)).toEqual([])
  })
})

describe('redemption coverage', () => {
  it('gives every variable-reward card at least one redemption scenario', () => {
    const uncovered = VERIFIED_CARD_SET.filter(
      c => c.ruleData.ruleType === 'variable' && c.redemptions.length === 0
    )
    expect(uncovered.map(c => `${c.issuer} ${c.name}`)).toEqual([])
  })

  it('gives cash-back cards a direct rule, since their value needs no redemption', () => {
    const wrong = VERIFIED_CARD_SET.filter(
      c => c.rewardCurrency === 'cash-back' && c.ruleData.ruleType !== 'direct'
    )
    expect(wrong.map(c => `${c.issuer} ${c.name}`)).toEqual([])
  })

  it('values every point above zero', () => {
    const bad = ALL_SEED_CARDS.flatMap(c =>
      c.redemptions.filter(r => r.centsPerPoint <= 0).map(r => `${c.name} ${r.redemptionType}`)
    )
    expect(bad).toEqual([])
  })

  it('has at least one scenario covering all categories per variable card', () => {
    const uncovered = VERIFIED_CARD_SET.filter(
      c =>
        c.ruleData.ruleType === 'variable' &&
        !c.redemptions.some(r => r.applicableCategories.length === 0)
    )
    expect(uncovered.map(c => `${c.issuer} ${c.name}`)).toEqual([])
  })
})
