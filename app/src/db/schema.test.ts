import { describe, it, expect } from 'vitest'
import {
  evidenceStatusEnum,
  sources,
  verificationRecords,
  cards,
  ruleVersions,
  redemptionScenarios,
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
