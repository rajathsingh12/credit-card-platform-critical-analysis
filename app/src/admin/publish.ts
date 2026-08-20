import type { Pool } from 'pg'
import { withTransaction } from '../db/transaction'
import { validateLeadForApproval } from './gate'
import { isPublishable, EVIDENCE_STATUSES, type EvidenceStatus } from '../catalog/evidence'

export type PublishedRuleVersion = {
  id: string
  card_id: string
  effective_from: string
  effective_to: string | null
  created_at: string
}

export type PublishFailureCode =
  | 'invalid-effective-from'
  | 'lead-not-found'
  | 'lead-not-approvable'
  | 'evidence-below-standard'

export type PublishResult =
  | { ok: true; ruleVersion: PublishedRuleVersion }
  | { ok: false; code: PublishFailureCode; error: string }

class PublishAbort extends Error {
  constructor(public readonly result: Extract<PublishResult, { ok: false }>) {
    super(result.error)
  }
}

type Validation = { ok: true } | { ok: false; error: string }

export function validateEffectiveFrom(value: unknown): Validation {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return { ok: false, error: 'effectiveFrom is required and must be YYYY-MM-DD' }
  }
  const [year, month, day] = value.split('-').map(Number)
  const parsed = new Date(Date.UTC(year, month - 1, day))
  const roundTrips =
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  if (!roundTrips) {
    return { ok: false, error: `effectiveFrom is not a real calendar date: ${value}` }
  }
  return { ok: true }
}

export function validateEvidenceStandard(evidenceStatus: unknown): Validation {
  if (
    typeof evidenceStatus !== 'string' ||
    !EVIDENCE_STATUSES.includes(evidenceStatus as EvidenceStatus)
  ) {
    return { ok: false, error: `unrecognised evidence status: ${String(evidenceStatus)}` }
  }
  if (!isPublishable(evidenceStatus as EvidenceStatus)) {
    return {
      ok: false,
      error: `${evidenceStatus} evidence does not meet the publication standard (ADR 0003)`,
    }
  }
  return { ok: true }
}

/**
 * The only path from a Data Lead to a published Rule Version. The admin approval route and the
 * seed both call it, so no caller can publish without passing the same checks.
 */
export async function publishLead(
  pool: Pool,
  leadId: string,
  effectiveFrom: string
): Promise<PublishResult> {
  const dateCheck = validateEffectiveFrom(effectiveFrom)
  if (!dateCheck.ok) {
    return { ok: false, code: 'invalid-effective-from', error: dateCheck.error }
  }

  return withTransaction(pool, async (client): Promise<PublishResult> => {
    const leadRes = await client.query(
      `SELECT dl.id, dl.card_id, dl.proposed_rule_data, dl.verification_record_id, dl.status,
              vr.evidence_status
       FROM data_leads dl
       LEFT JOIN verification_records vr ON vr.id = dl.verification_record_id
       WHERE dl.id = $1
       FOR UPDATE OF dl`,
      [leadId]
    )
    const lead = leadRes.rows[0]
    if (!lead) {
      throw new PublishAbort({ ok: false, code: 'lead-not-found', error: 'lead not found' })
    }

    const structural = validateLeadForApproval(lead)
    if (!structural.ok) {
      throw new PublishAbort({ ok: false, code: 'lead-not-approvable', error: structural.error })
    }

    const evidence = validateEvidenceStandard(lead.evidence_status)
    if (!evidence.ok) {
      throw new PublishAbort({ ok: false, code: 'evidence-below-standard', error: evidence.error })
    }

    // Close the current active version (effective_to NULL → day before new version starts).
    await client.query(
      `UPDATE rule_versions
       SET effective_to = $1::date - 1
       WHERE card_id = $2 AND effective_to IS NULL`,
      [effectiveFrom, lead.card_id]
    )

    const rvRes = await client.query(
      `INSERT INTO rule_versions (card_id, verification_record_id, effective_from, rule_data)
       VALUES ($1, $2, $3, $4)
       RETURNING id, card_id, effective_from, effective_to, created_at`,
      [lead.card_id, lead.verification_record_id, effectiveFrom, JSON.stringify(lead.proposed_rule_data)]
    )

    await client.query(
      `UPDATE data_leads SET status = 'approved', updated_at = NOW() WHERE id = $1`,
      [leadId]
    )

    return { ok: true, ruleVersion: rvRes.rows[0] as PublishedRuleVersion }
  }).catch((err) => {
    if (err instanceof PublishAbort) return err.result
    throw err
  })
}
