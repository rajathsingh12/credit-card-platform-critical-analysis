import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/db/client'

export const runtime = 'nodejs'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const result = await pool.query(
    `SELECT
       cr.id,
       cr.description,
       cr.source_url,
       cr.trace_context,
       cr.created_at,
       c.id        AS card_id,
       c.name      AS card_name,
       c.issuer    AS card_issuer,
       c.network   AS card_network,
       rv.id       AS rule_version_id,
       rv.rule_data AS rule_version_rule_data,
       rv.effective_from AS rule_version_effective_from,
       rv.effective_to   AS rule_version_effective_to,
       rv.retracted_at   AS rule_version_retracted_at,
       rv.created_at     AS rule_version_created_at,
       vr.id       AS verification_record_id,
       vr.evidence_status,
       vr.verified_at,
       vr.notes    AS verification_notes
     FROM contextual_reports cr
     INNER JOIN cards c ON c.id = cr.card_id
     LEFT JOIN rule_versions rv ON rv.id = cr.rule_version_id
     LEFT JOIN verification_records vr ON vr.id = rv.verification_record_id
     WHERE cr.id = $1`,
    [id]
  )

  const row = result.rows[0]
  if (!row) {
    return NextResponse.json({ error: 'report not found' }, { status: 404 })
  }

  const hasRuleVersion = Boolean(row.rule_version_id)
  const report = {
    id: row.id,
    description: row.description,
    sourceUrl: row.source_url ?? null,
    traceContext: row.trace_context ?? null,
    createdAt: row.created_at,
    card: {
      id: row.card_id,
      name: row.card_name,
      issuer: row.card_issuer,
      network: row.card_network,
    },
    ruleVersion: hasRuleVersion
      ? {
          id: row.rule_version_id,
          ruleData: row.rule_version_rule_data,
          effectiveFrom: row.rule_version_effective_from,
          effectiveTo: row.rule_version_effective_to ?? null,
          retractedAt: row.rule_version_retracted_at ?? null,
          createdAt: row.rule_version_created_at,
        }
      : null,
    verificationRecord: row.verification_record_id
      ? {
          id: row.verification_record_id,
          evidenceStatus: row.evidence_status,
          verifiedAt: row.verified_at,
          notes: row.verification_notes ?? null,
        }
      : null,
  }

  return NextResponse.json({ report })
}