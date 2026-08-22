import { describe, it, expect, vi } from 'vitest'
import type { Pool, PoolClient } from 'pg'
import { publishLead, validateEffectiveFrom, validateEvidenceStandard } from './publish'

describe('validateEffectiveFrom', () => {
  it('accepts an ISO calendar date', () => {
    expect(validateEffectiveFrom('2025-01-01')).toEqual({ ok: true })
  })

  it('rejects a missing value', () => {
    expect(validateEffectiveFrom(undefined).ok).toBe(false)
    expect(validateEffectiveFrom(null).ok).toBe(false)
  })

  it('rejects a non-string', () => {
    expect(validateEffectiveFrom(20250101).ok).toBe(false)
  })

  it('rejects a wrongly formatted date', () => {
    expect(validateEffectiveFrom('01-01-2025').ok).toBe(false)
    expect(validateEffectiveFrom('2025-1-1').ok).toBe(false)
  })

  it('rejects a date that does not exist', () => {
    expect(validateEffectiveFrom('2025-02-30').ok).toBe(false)
    expect(validateEffectiveFrom('2025-13-01').ok).toBe(false)
  })
})

describe('validateEvidenceStandard', () => {
  it('accepts officially-documented', () => {
    expect(validateEvidenceStandard('officially-documented')).toEqual({ ok: true })
  })

  it('accepts statement-verified', () => {
    expect(validateEvidenceStandard('statement-verified')).toEqual({ ok: true })
  })

  it('rejects inferred', () => {
    const result = validateEvidenceStandard('inferred')
    expect(result.ok).toBe(false)
    expect(result.ok === false && result.error).toMatch(/inferred/)
  })

  it('rejects community-reported', () => {
    expect(validateEvidenceStandard('community-reported').ok).toBe(false)
  })

  it('rejects a missing evidence status', () => {
    expect(validateEvidenceStandard(null).ok).toBe(false)
  })

  it('rejects an unrecognised evidence status', () => {
    expect(validateEvidenceStandard('vibes').ok).toBe(false)
  })
})

const PENDING_LEAD = {
  id: 'lead-1',
  card_id: 'card-1',
  proposed_rule_data: { multiplier: 2 },
  verification_record_id: 'vr-1',
  status: 'pending',
  evidence_status: 'officially-documented',
}

const INSERTED_RULE_VERSION = {
  id: 'rv-1',
  card_id: 'card-1',
  effective_from: '2026-01-01',
  effective_to: null,
  created_at: '2026-01-01T00:00:00.000Z',
}

/** Collapses each statement to a stable name so a test can assert the transaction's shape. */
function label(sql: string): string {
  if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') return sql
  if (sql.includes('FOR UPDATE OF dl')) return 'lock-lead'
  if (sql.includes('UPDATE rule_versions')) return 'close-active-version'
  if (sql.includes('INSERT INTO rule_versions')) return 'insert-rule-version'
  if (sql.includes('UPDATE data_leads')) return 'approve-lead'
  return sql
}

function makeFakePool(
  options: { lead?: Record<string, unknown> | null; rejectOn?: string } = {}
) {
  const { lead = PENDING_LEAD, rejectOn } = options
  const queries: string[] = []
  const client = {
    query: vi.fn(async (sql: string) => {
      queries.push(sql)
      if (rejectOn && sql.includes(rejectOn)) throw new Error('connection reset')
      if (sql.includes('FOR UPDATE OF dl')) return { rows: lead ? [lead] : [] }
      if (sql.includes('INSERT INTO rule_versions')) return { rows: [INSERTED_RULE_VERSION] }
      return { rows: [] }
    }),
    release: vi.fn(),
  } as unknown as PoolClient
  const pool = { connect: async () => client } as unknown as Pool
  return { pool, queries, shape: () => queries.map(label) }
}

describe('publishLead', () => {
  it('locks the lead, writes, and commits — in that order', async () => {
    const { pool, shape } = makeFakePool()

    const result = await publishLead(pool, 'lead-1', '2026-01-01')

    expect(result).toEqual({ ok: true, ruleVersion: INSERTED_RULE_VERSION })
    expect(shape()).toEqual([
      'BEGIN',
      'lock-lead',
      'close-active-version',
      'insert-rule-version',
      'approve-lead',
      'COMMIT',
    ])
  })

  it('rolls back and returns lead-not-found when the lead does not exist', async () => {
    const { pool, shape } = makeFakePool({ lead: null })

    const result = await publishLead(pool, 'missing', '2026-01-01')

    expect(result).toEqual({ ok: false, code: 'lead-not-found', error: 'lead not found' })
    expect(shape()).toEqual(['BEGIN', 'lock-lead', 'ROLLBACK'])
  })

  it('rolls back and returns lead-not-approvable when the lead is not pending', async () => {
    const { pool, shape } = makeFakePool({ lead: { ...PENDING_LEAD, status: 'approved' } })

    const result = await publishLead(pool, 'lead-1', '2026-01-01')

    expect(result.ok).toBe(false)
    expect(result.ok === false && result.code).toBe('lead-not-approvable')
    expect(shape()).toEqual(['BEGIN', 'lock-lead', 'ROLLBACK'])
  })

  it('rolls back and returns evidence-below-standard when evidence is inferred', async () => {
    const { pool, shape } = makeFakePool({
      lead: { ...PENDING_LEAD, evidence_status: 'inferred' },
    })

    const result = await publishLead(pool, 'lead-1', '2026-01-01')

    expect(result.ok).toBe(false)
    expect(result.ok === false && result.code).toBe('evidence-below-standard')
    expect(shape()).toEqual(['BEGIN', 'lock-lead', 'ROLLBACK'])
  })

  it('returns invalid-effective-from without opening a transaction', async () => {
    const { pool, queries } = makeFakePool()

    const result = await publishLead(pool, 'lead-1', 'yesterday')

    expect(result.ok).toBe(false)
    expect(result.ok === false && result.code).toBe('invalid-effective-from')
    expect(queries).toEqual([])
  })

  it('propagates an unexpected query error instead of mapping it to a PublishResult', async () => {
    const { pool, shape } = makeFakePool({ rejectOn: 'INSERT INTO rule_versions' })

    await expect(publishLead(pool, 'lead-1', '2026-01-01')).rejects.toThrow('connection reset')
    expect(shape()).toEqual([
      'BEGIN',
      'lock-lead',
      'close-active-version',
      'insert-rule-version',
      'ROLLBACK',
    ])
  })
})
