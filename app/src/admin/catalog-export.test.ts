import { describe, it, expect } from 'vitest'
import {
  assembleCatalog,
  catalogVersionLabel,
  windowsOverlap,
  type RvRow,
  type RsRow,
} from './catalog-export'

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

  it('exposes an empty redemptionScenarios array on every rule version when there are none', () => {
    const { cards } = assembleCatalog([RV_ROW_A], [], NOW)
    expect(cards[0].ruleVersions[0].redemptionScenarios).toEqual([])
  })

  it('attaches an overlapping scenario to its rule version and keeps the card-level array', () => {
    const { cards } = assembleCatalog([RV_ROW_A], [RS_ROW_A], NOW)
    const card = cards[0]
    expect(card.redemptionScenarios).toHaveLength(1)
    expect(card.ruleVersions[0].redemptionScenarios).toHaveLength(1)
    expect(card.ruleVersions[0].redemptionScenarios[0].id).toBe('rs-1')
  })

  it('does not pair a disjoint scenario with a rule version', () => {
    const disjoint: RsRow = { ...RS_ROW_A, effective_from: '2023-01-01', effective_to: '2023-12-31' }
    const { cards } = assembleCatalog([RV_ROW_A], [disjoint], NOW)
    const card = cards[0]
    expect(card.redemptionScenarios).toHaveLength(1)
    expect(card.ruleVersions[0].redemptionScenarios).toHaveLength(0)
  })

  it('pairs a scenario that begins on a rule version effectiveTo date (inclusive boundary)', () => {
    const boundary: RsRow = { ...RS_ROW_A, effective_from: '2024-12-31', effective_to: '2025-06-30' }
    const { cards } = assembleCatalog([RV_ROW_PRIOR, RV_ROW_A], [boundary], NOW)
    const card = cards[0]
    const prior = card.ruleVersions.find(r => r.id === 'rv-prior')!
    const current = card.ruleVersions.find(r => r.id === 'rv-1')!
    expect(prior.effectiveTo).toBe('2024-12-31')
    expect(prior.redemptionScenarios.map(s => s.id)).toEqual(['rs-1'])
    expect(current.redemptionScenarios.map(s => s.id)).toEqual(['rs-1'])
  })

  it('pairs a scenario that ends on a rule version effectiveFrom date (inclusive boundary)', () => {
    const ending: RsRow = { ...RS_ROW_A, effective_from: '2023-06-01', effective_to: '2024-01-01' }
    const { cards } = assembleCatalog([RV_ROW_PRIOR], [ending], NOW)
    const prior = cards[0].ruleVersions[0]
    expect(prior.effectiveFrom).toBe('2024-01-01')
    expect(prior.redemptionScenarios.map(s => s.id)).toEqual(['rs-1'])
  })

  it('pairs an open-ended scenario with an open-ended rule version', () => {
    const { cards } = assembleCatalog([RV_ROW_A], [RS_ROW_A], NOW)
    expect(cards[0].ruleVersions[0].effectiveTo).toBeNull()
    expect(cards[0].ruleVersions[0].redemptionScenarios.map(s => s.id)).toEqual(['rs-1'])
  })

  it('does not pair an open-ended rule version with a bounded scenario that ended before it began', () => {
    const openVersion: RvRow = { ...RV_ROW_A, rv_effective_from: '2025-01-01', rv_effective_to: null }
    const pastOnly: RsRow = { ...RS_ROW_A, effective_from: '2023-01-01', effective_to: '2024-12-31' }
    const { cards } = assembleCatalog([openVersion], [pastOnly], NOW)
    expect(cards[0].redemptionScenarios).toHaveLength(1)
    expect(cards[0].ruleVersions[0].redemptionScenarios).toHaveLength(0)
  })

  it('spreads a scenario across multiple overlapping rule versions while keeping one card-level entry', () => {
    const spanning: RsRow = { ...RS_ROW_A, effective_from: '2024-01-01', effective_to: '2025-12-31' }
    const { cards } = assembleCatalog([RV_ROW_PRIOR, RV_ROW_A], [spanning], NOW)
    const card = cards[0]
    expect(card.redemptionScenarios).toHaveLength(1)
    expect(card.ruleVersions.find(r => r.id === 'rv-prior')!.redemptionScenarios).toHaveLength(1)
    expect(card.ruleVersions.find(r => r.id === 'rv-1')!.redemptionScenarios).toHaveLength(1)
  })

  it('never pairs scenarios across cards even when date windows overlap', () => {
    const rvCard2: RvRow = { ...RV_ROW_A, card_id: 'card-2', card_name: 'Millennia', rv_id: 'rv-2' }
    // scenario belongs to card-2 but its window overlaps card-1's rule version
    const rsCard2: RsRow = { ...RS_ROW_A, card_id: 'card-2', id: 'rs-2' }
    const { cards } = assembleCatalog([RV_ROW_A, rvCard2], [RS_ROW_A, rsCard2], NOW)
    const card1 = cards.find(c => c.id === 'card-1')!
    const card2 = cards.find(c => c.id === 'card-2')!
    expect(card1.redemptionScenarios.map(s => s.id)).toEqual(['rs-1'])
    expect(card1.ruleVersions[0].redemptionScenarios.map(s => s.id)).toEqual(['rs-1'])
    expect(card2.redemptionScenarios.map(s => s.id)).toEqual(['rs-2'])
    expect(card2.ruleVersions[0].redemptionScenarios.map(s => s.id)).toEqual(['rs-2'])
  })
})

describe('windowsOverlap', () => {
  it('returns false for fully disjoint windows', () => {
    expect(windowsOverlap('2025-01-01', '2025-02-01', '2025-03-01', null)).toBe(false)
  })

  it('returns true for ordinary overlap', () => {
    expect(windowsOverlap('2025-01-01', '2025-06-30', '2025-03-01', '2025-09-30')).toBe(true)
  })

  it('honors inclusive boundaries both directions', () => {
    expect(windowsOverlap('2025-06-30', '2025-12-31', '2025-01-01', '2025-06-30')).toBe(true)
    expect(windowsOverlap('2025-01-01', '2025-01-01', '2025-01-01', '2025-12-31')).toBe(true)
  })

  it('treats null effectiveTo as unbounded', () => {
    expect(windowsOverlap('2025-01-01', null, '2099-01-01', null)).toBe(true)
    expect(windowsOverlap('2025-01-01', '2025-02-01', '2025-03-01', null)).toBe(false)
  })
})
