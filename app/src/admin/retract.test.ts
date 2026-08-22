import { describe, it, expect, vi } from 'vitest'
import type { Pool, PoolClient } from 'pg'
import {
  retractRuleVersion,
  validateRetractionReason,
  validateRuleVersionForRetraction,
} from './retract'

describe('validateRetractionReason', () => {
  it('accepts a non-empty string', () => {
    expect(validateRetractionReason('incorrect multiplier published')).toEqual({ ok: true })
  })

  it('rejects an empty string', () => {
    expect(validateRetractionReason('').ok).toBe(false)
  })

  it('rejects a whitespace-only string', () => {
    expect(validateRetractionReason('   ').ok).toBe(false)
  })

  it('rejects null', () => {
    expect(validateRetractionReason(null).ok).toBe(false)
  })

  it('rejects undefined', () => {
    expect(validateRetractionReason(undefined).ok).toBe(false)
  })

  it('rejects a number', () => {
    expect(validateRetractionReason(42).ok).toBe(false)
  })
})

describe('validateRuleVersionForRetraction', () => {
  it('accepts an unretracted rule version', () => {
    expect(validateRuleVersionForRetraction({ retracted_at: null })).toEqual({ ok: true })
  })

  it('rejects null (not found)', () => {
    const result = validateRuleVersionForRetraction(null)
    expect(result.ok).toBe(false)
    expect(result.ok === false && result.code).toBe('not-found')
  })

  it('rejects an already-retracted rule version', () => {
    const result = validateRuleVersionForRetraction({ retracted_at: '2026-01-01T00:00:00Z' })
    expect(result.ok).toBe(false)
    expect(result.ok === false && result.code).toBe('already-retracted')
    expect(result.ok === false && result.error).toMatch(/already retracted/)
  })
})

const ACTIVE_RULE_VERSION = { id: 'rv-1', card_id: 'card-1', retracted_at: null }
const CORRECTION_ROW = { id: 'ch-1', retracted_at: '2026-08-22T12:00:00.000Z' }

/** Collapses each statement to a stable name so a test can assert the transaction's shape. */
function label(sql: string): string {
  if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') return sql
  if (sql.includes('FOR UPDATE')) return 'lock-rule-version'
  if (sql.includes('UPDATE rule_versions')) return 'mark-retracted'
  if (sql.includes('INSERT INTO correction_history')) return 'insert-correction-history'
  return sql
}

function makeFakePool(
  options: { ruleVersion?: Record<string, unknown> | null; rejectOn?: string } = {}
) {
  const { ruleVersion = ACTIVE_RULE_VERSION, rejectOn } = options
  const queries: string[] = []
  const client = {
    query: vi.fn(async (sql: string) => {
      queries.push(sql)
      if (rejectOn && sql.includes(rejectOn)) throw new Error('connection reset')
      if (sql.includes('FOR UPDATE')) return { rows: ruleVersion ? [ruleVersion] : [] }
      if (sql.includes('INSERT INTO correction_history')) return { rows: [CORRECTION_ROW] }
      return { rows: [] }
    }),
    release: vi.fn(),
  } as unknown as PoolClient
  const pool = { connect: async () => client } as unknown as Pool
  return { pool, queries, shape: () => queries.map(label) }
}

describe('retractRuleVersion', () => {
  it('locks the rule version, writes, and commits — in that order', async () => {
    const { pool, shape } = makeFakePool()

    const result = await retractRuleVersion(pool, 'rv-1', 'incorrect multiplier published')

    expect(result).toEqual({
      ok: true,
      correctionHistoryId: 'ch-1',
      retractedAt: CORRECTION_ROW.retracted_at,
      cardId: 'card-1',
    })
    expect(shape()).toEqual([
      'BEGIN',
      'lock-rule-version',
      'mark-retracted',
      'insert-correction-history',
      'COMMIT',
    ])
  })

  it('rolls back and returns not-found when the rule version does not exist', async () => {
    const { pool, shape } = makeFakePool({ ruleVersion: null })

    const result = await retractRuleVersion(pool, 'missing', 'bad data')

    expect(result).toEqual({ ok: false, code: 'not-found', error: 'rule version not found' })
    expect(shape()).toEqual(['BEGIN', 'lock-rule-version', 'ROLLBACK'])
  })

  it('rolls back and returns already-retracted for a retracted rule version', async () => {
    const { pool, shape } = makeFakePool({
      ruleVersion: { ...ACTIVE_RULE_VERSION, retracted_at: '2026-01-01T00:00:00.000Z' },
    })

    const result = await retractRuleVersion(pool, 'rv-1', 'bad data')

    expect(result.ok).toBe(false)
    expect(result.ok === false && result.code).toBe('already-retracted')
    expect(shape()).toEqual(['BEGIN', 'lock-rule-version', 'ROLLBACK'])
  })

  it('returns invalid-reason without opening a transaction', async () => {
    const { pool, queries } = makeFakePool()

    const result = await retractRuleVersion(pool, 'rv-1', '   ')

    expect(result.ok).toBe(false)
    expect(result.ok === false && result.code).toBe('invalid-reason')
    expect(queries).toEqual([])
  })

  it('propagates an unexpected query error instead of mapping it to a RetractionResult', async () => {
    const { pool, shape } = makeFakePool({ rejectOn: 'INSERT INTO correction_history' })

    await expect(retractRuleVersion(pool, 'rv-1', 'bad data')).rejects.toThrow('connection reset')
    expect(shape()).toEqual([
      'BEGIN',
      'lock-rule-version',
      'mark-retracted',
      'insert-correction-history',
      'ROLLBACK',
    ])
  })
})
