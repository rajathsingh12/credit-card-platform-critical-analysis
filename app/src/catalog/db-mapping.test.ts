import { describe, it, expect } from 'vitest'
import { toIsoDate, toEngineRuleVersion, toEngineScenario } from './db-mapping'

describe('toIsoDate', () => {
  it('keeps a plain date string', () => {
    expect(toIsoDate('2025-01-01')).toBe('2025-01-01')
  })

  it('trims a timestamp string to its date', () => {
    expect(toIsoDate('2025-01-01T00:00:00.000Z')).toBe('2025-01-01')
  })

  it('reads a local-midnight Date without slipping to the previous day', () => {
    const localMidnight = new Date(2025, 0, 1)
    expect(toIsoDate(localMidnight)).toBe('2025-01-01')
  })

  it('pads single-digit months and days', () => {
    expect(toIsoDate(new Date(2025, 8, 5))).toBe('2025-09-05')
  })
})

describe('toEngineRuleVersion', () => {
  it('maps a row to the shape the engine expects', () => {
    expect(
      toEngineRuleVersion({
        id: 'rv-1',
        card_id: 'card-1',
        effective_from: new Date(2025, 0, 1),
        effective_to: null,
        rule_data: {
          ruleType: 'direct',
          categories: [],
          exclusions: ['fuel'],
          pointsPerDollar: 1,
          capPoints: null,
        },
      })
    ).toEqual({
      id: 'rv-1',
      cardId: 'card-1',
      effectiveFrom: '2025-01-01',
      effectiveTo: null,
      ruleData: {
        ruleType: 'direct',
        categories: [],
        exclusions: ['fuel'],
        pointsPerDollar: 1,
        capPoints: null,
      },
    })
  })

  it('maps a closed version', () => {
    const rule = toEngineRuleVersion({
      id: 'rv-1',
      card_id: 'card-1',
      effective_from: new Date(2024, 0, 1),
      effective_to: new Date(2024, 11, 31),
      rule_data: {
        ruleType: 'direct',
        categories: [],
        exclusions: [],
        pointsPerDollar: 1,
        capPoints: null,
      },
    })
    expect(rule.effectiveTo).toBe('2024-12-31')
  })
})

describe('toEngineScenario', () => {
  const row = {
    id: 'rs-1',
    card_id: 'card-1',
    redemption_type: 'travel-portal',
    applicable_categories: ['travel'],
    cents_per_point: '50.0000',
    effective_from: new Date(2025, 0, 1),
    effective_to: null,
    annual_fee_cents: 600_000,
  }

  it('parses the numeric point value that pg returns as a string', () => {
    expect(toEngineScenario(row).centsPerPoint).toBe(50)
  })

  it('keeps a fractional point value exact enough to price a redemption', () => {
    expect(toEngineScenario({ ...row, cents_per_point: '0.2500' }).centsPerPoint).toBe(0.25)
  })

  it('carries the annual fee joined from the card', () => {
    expect(toEngineScenario(row).annualFeeCents).toBe(600_000)
    expect(toEngineScenario({ ...row, annual_fee_cents: null }).annualFeeCents).toBeNull()
  })

  it('maps the remaining fields the engine reads', () => {
    const scenario = toEngineScenario(row)
    expect(scenario.redemptionType).toBe('travel-portal')
    expect(scenario.applicableCategories).toEqual(['travel'])
    expect(scenario.effectiveFrom).toBe('2025-01-01')
    expect(scenario.effectiveTo).toBeNull()
  })

  it('refuses a point value it cannot price', () => {
    expect(() => toEngineScenario({ ...row, cents_per_point: 'free' })).toThrow(/non-numeric/)
  })
})
