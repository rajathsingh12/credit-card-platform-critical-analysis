import type { Pool } from 'pg'
import { withTransaction } from '../db/transaction'

export type RetractionFailureCode = 'not-found' | 'already-retracted' | 'invalid-reason'

export type RetractionResult =
  | { ok: true; correctionHistoryId: string; retractedAt: string; cardId: string }
  | { ok: false; code: RetractionFailureCode; error: string }

class RetractionAbort extends Error {
  constructor(public readonly result: Extract<RetractionResult, { ok: false }>) {
    super(result.error)
  }
}

export function validateRetractionReason(
  reason: unknown
): { ok: true } | { ok: false; error: string } {
  if (typeof reason !== 'string' || !reason.trim()) {
    return { ok: false, error: 'retraction reason is required' }
  }
  return { ok: true }
}

export function validateRuleVersionForRetraction(
  rv: { retracted_at: string | null } | null
): { ok: true } | { ok: false; code: Extract<RetractionFailureCode, 'not-found' | 'already-retracted'>; error: string } {
  if (rv === null) {
    return { ok: false, code: 'not-found', error: 'rule version not found' }
  }
  if (rv.retracted_at !== null) {
    return { ok: false, code: 'already-retracted', error: 'rule version is already retracted' }
  }
  return { ok: true }
}

export async function retractRuleVersion(
  pool: Pool,
  ruleVersionId: string,
  reason: string
): Promise<RetractionResult> {
  const reasonCheck = validateRetractionReason(reason)
  if (!reasonCheck.ok) {
    return { ok: false, code: 'invalid-reason', error: reasonCheck.error }
  }

  return withTransaction(pool, async (client): Promise<RetractionResult> => {
    const rvRes = await client.query(
      `SELECT id, card_id, retracted_at FROM rule_versions WHERE id = $1 FOR UPDATE`,
      [ruleVersionId]
    )
    const rv = rvRes.rows[0] ?? null

    const check = validateRuleVersionForRetraction(rv)
    if (!check.ok) {
      throw new RetractionAbort({ ok: false, code: check.code, error: check.error })
    }

    const now = new Date()
    const todayMinus1 = new Date(now)
    todayMinus1.setDate(todayMinus1.getDate() - 1)
    const effectiveTo = todayMinus1.toISOString().slice(0, 10)

    await client.query(
      `UPDATE rule_versions
       SET retracted_at = $1, effective_to = COALESCE(effective_to, $2::date)
       WHERE id = $3`,
      [now.toISOString(), effectiveTo, ruleVersionId]
    )

    const chRes = await client.query(
      `INSERT INTO correction_history (rule_version_id, card_id, retraction_reason, retracted_at)
       VALUES ($1, $2, $3, $4)
       RETURNING id, retracted_at`,
      [ruleVersionId, rv.card_id, reason.trim(), now.toISOString()]
    )

    const row = chRes.rows[0]
    return {
      ok: true,
      correctionHistoryId: row.id,
      retractedAt: new Date(row.retracted_at).toISOString(),
      cardId: rv.card_id,
    }
  }).catch((err) => {
    if (err instanceof RetractionAbort) return err.result
    throw err
  })
}
