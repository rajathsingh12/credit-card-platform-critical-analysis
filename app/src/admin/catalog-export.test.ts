import { describe, it, expect } from 'vitest'
import { assembleCatalog, catalogVersionLabel, type RvRow, type RsRow } from './catalog-export'

const NOW = new Date('2026-08-18T10:00:00.000Z')

const RV_ROW_A: RvRow = {
  card_id: 'card-1',
  card_name: 'Regalia Gold',
  card_issuer: 'HDFC Bank',
  card_network: 'Visa',
  reward_currency: 'issuer-points',
  annual_fee_cents: 250000,
  rv_id: 'rv-1',
  rv_effective_from: '2025-01-01',
  rv_effective_to: null,
  rv_rule_data: { ruleType: 'flat', pointsPerDollar: 4 },
  evidence_status: 'officially-documented',
}

const RV_ROW_PRIOR: RvRow = {
  ...RV_ROW_A,
  rv_id: 'rv-prior',
  rv_effective_from: '2024-01-01',
  rv_effective_to: '2024-12-31',
}

const RS_ROW_A: RsRow = {
  id: 'rs-1',
  card_id: 'card-1',
  name: 'Travel portal',
  description: 'Book on portal',
  redemption_type: 'travel-portal',
  applicable_categories: [],
  cents_per_point: '2.0000',
  effective_from: '2025-01-01',
  effective_to: null,
}

describe('catalogVersionLabel', () => {
  it('returns the ISO date portion', () => {
    expect(catalogVersionLabel(NOW)).toBe('2026-08-18')
  })
})

describe('assembleCatalog', () => {
  it('produces correct top-level envelope', () => {
    const result = assembleCatalog([RV_ROW_A], [], NOW)
    expect(result.catalogVersion).toBe('2026-08-18')
    expect(result.exportedAt).toBe(NOW.toISOString())
    expect(result.cards).toHaveLength(1)
  })

  it('maps card fields', () => {
    const { cards } = assembleCatalog([RV_ROW_A], [], NOW)
    expect(cards[0]).toMatchObject({
      id: 'card-1',
      name: 'Regalia Gold',
      issuer: 'HDFC Bank',
      network: 'Visa',
      rewardCurrency: 'issuer-points',
      annualFeeCents: 250000,
    })
  })

  it('maps rule version fields including evidence status', () => {
    const rv = assembleCatalog([RV_ROW_A], [], NOW).cards[0].ruleVersions[0]
    expect(rv.id).toBe('rv-1')
    expect(rv.effectiveFrom).toBe('2025-01-01')
    expect(rv.effectiveTo).toBeNull()
    expect(rv.evidenceStatus).toBe('officially-documented')
    expect(rv.ruleData).toEqual({ ruleType: 'flat', pointsPerDollar: 4 })
  })

  it('includes all non-retracted rule versions per card', () => {
    const { cards } = assembleCatalog([RV_ROW_A, RV_ROW_PRIOR], [], NOW)
    expect(cards[0].ruleVersions).toHaveLength(2)
    expect(cards[0].ruleVersions.find(r => r.id === 'rv-prior')?.effectiveTo).toBe('2024-12-31')
  })

  it('maps redemption scenarios and coerces cents_per_point to number', () => {
    const rs = assembleCatalog([RV_ROW_A], [RS_ROW_A], NOW).cards[0].redemptionScenarios[0]
    expect(rs.id).toBe('rs-1')
    expect(rs.redemptionType).toBe('travel-portal')
    expect(rs.centsPerPoint).toBe(2)
    expect(rs.effectiveTo).toBeNull()
  })

  it('drops redemption scenarios for cards not in the export', () => {
    const orphan: RsRow = { ...RS_ROW_A, card_id: 'card-missing' }
    const { cards } = assembleCatalog([RV_ROW_A], [orphan], NOW)
    expect(cards[0].redemptionScenarios).toHaveLength(0)
  })

  it('groups multiple cards', () => {
    const rvCard2: RvRow = { ...RV_ROW_A, card_id: 'card-2', card_name: 'Millennia', rv_id: 'rv-2' }
    const { cards } = assembleCatalog([RV_ROW_A, rvCard2], [], NOW)
    expect(cards).toHaveLength(2)
  })

  it('returns empty cards array when no rule version rows', () => {
    expect(assembleCatalog([], [], NOW).cards).toHaveLength(0)
  })

  it('handles null annual_fee_cents', () => {
    const rv: RvRow = { ...RV_ROW_A, annual_fee_cents: null }
    expect(assembleCatalog([rv], [], NOW).cards[0].annualFeeCents).toBeNull()
  })
})
