import { NextResponse } from 'next/server'
import { pool } from '@/db/client'

export const runtime = 'nodejs'

export async function GET() {
  const result = await pool.query(`
    SELECT
      ch.id,
      ch.rule_version_id,
      ch.retraction_reason,
      ch.retracted_at,
      c.id     AS card_id,
      c.name   AS card_name,
      c.issuer AS card_issuer
    FROM correction_history ch
    JOIN cards c ON c.id = ch.card_id
    ORDER BY ch.retracted_at DESC
  `)

  const entries = result.rows.map(r => ({
    id: r.id,
    ruleVersionId: r.rule_version_id,
    retractionReason: r.retraction_reason,
    retractedAt: r.retracted_at,
    card: { id: r.card_id, name: r.card_name, issuer: r.card_issuer },
  }))

  return NextResponse.json({ entries })
}
