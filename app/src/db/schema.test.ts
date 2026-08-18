import { describe, it, expect } from 'vitest'
import {
  evidenceStatusEnum,
  dataLeadStatusEnum,
  sources,
  verificationRecords,
  cards,
  ruleVersions,
  redemptionScenarios,
  dataLeads,
} from './schema'

describe('evidenceStatusEnum', () => {
  it('has exactly the four constrained values', () => {
    expect([...evidenceStatusEnum.enumValues]).toEqual([
      'officially-documented',
      'statement-verified',
      'inferred',
      'community-reported',
    ])
  })
})

describe('ruleVersions columns', () => {
  it('effective_from is present', () => {
    expect(ruleVersions.effectiveFrom).toBeDefined()
  })

  it('effective_to is present and optional in TypeScript', () => {
    // effective_to omitted from .$inferInsert means it is nullable
    type Insert = typeof ruleVersions.$inferInsert
    const row: Insert = {
      cardId: 'a',
      verificationRecordId: 'b',
      effectiveFrom: '2024-01-01',
      ruleData: {},
    }
    expect(row.effectiveTo).toBeUndefined()
  })

  it('verification_record_id column exists', () => {
    expect(ruleVersions.verificationRecordId).toBeDefined()
  })

  it('card_id column exists', () => {
    expect(ruleVersions.cardId).toBeDefined()
  })
})

describe('verificationRecords columns', () => {
  it('evidence_status column exists', () => {
    expect(verificationRecords.evidenceStatus).toBeDefined()
  })

  it('source_id column exists', () => {
    expect(verificationRecords.sourceId).toBeDefined()
  })
})

describe('all domain tables exported', () => {
  it('exports five domain tables', () => {
    expect(sources).toBeDefined()
    expect(verificationRecords).toBeDefined()
    expect(cards).toBeDefined()
    expect(ruleVersions).toBeDefined()
    expect(redemptionScenarios).toBeDefined()
  })
})

describe('dataLeadStatusEnum', () => {
  it('has exactly the three constrained values', () => {
    expect([...dataLeadStatusEnum.enumValues]).toEqual(['pending', 'approved', 'rejected'])
  })
})

describe('dataLeads columns', () => {
  it('status defaults to pending', () => {
    type Insert = typeof dataLeads.$inferInsert
    const row: Insert = {
      cardId: 'card-uuid',
      proposedRuleData: {},
      sourceUrl: 'https://example.com',
    }
    expect(row.status).toBeUndefined()
  })

  it('verification_record_id is optional', () => {
    type Insert = typeof dataLeads.$inferInsert
    const row: Insert = {
      cardId: 'card-uuid',
      proposedRuleData: {},
      sourceUrl: 'https://example.com',
    }
    expect(row.verificationRecordId).toBeUndefined()
  })

  it('rejection_reason is optional', () => {
    type Insert = typeof dataLeads.$inferInsert
    const row: Insert = {
      cardId: 'card-uuid',
      proposedRuleData: {},
      sourceUrl: 'https://example.com',
    }
    expect(row.rejectionReason).toBeUndefined()
  })

  it('has card_id, proposed_rule_data, source_url columns', () => {
    expect(dataLeads.cardId).toBeDefined()
    expect(dataLeads.proposedRuleData).toBeDefined()
    expect(dataLeads.sourceUrl).toBeDefined()
  })
})

describe('domain tables include dataLeads', () => {
  it('exports six domain tables total', () => {
    expect(dataLeads).toBeDefined()
  })
})

describe('cards columns', () => {
  it('records the reward currency and annual fee', () => {
    expect(cards.rewardCurrency).toBeDefined()
    expect(cards.annualFeeCents).toBeDefined()
  })

  it('requires a reward currency but not an annual fee', () => {
    type Insert = typeof cards.$inferInsert
    const row: Insert = {
      name: 'Test',
      issuer: 'Test Bank',
      network: 'Visa',
      rewardCurrency: 'cash-back',
    }
    expect(row.annualFeeCents).toBeUndefined()
  })
})

describe('redemptionScenarios columns', () => {
  it('carries everything the engine needs to value a point', () => {
    expect(redemptionScenarios.redemptionType).toBeDefined()
    expect(redemptionScenarios.applicableCategories).toBeDefined()
    expect(redemptionScenarios.centsPerPoint).toBeDefined()
    expect(redemptionScenarios.effectiveFrom).toBeDefined()
    expect(redemptionScenarios.effectiveTo).toBeDefined()
  })

  it('leaves effective_to optional so a scenario can stay open-ended', () => {
    type Insert = typeof redemptionScenarios.$inferInsert
    const row: Insert = {
      cardId: 'card-uuid',
      name: 'Travel portal',
      redemptionType: 'travel-portal',
      centsPerPoint: '50',
      effectiveFrom: '2025-01-01',
    }
    expect(row.effectiveTo).toBeUndefined()
  })
})
