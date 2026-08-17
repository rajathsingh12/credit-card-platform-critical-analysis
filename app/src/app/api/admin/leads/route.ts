import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/db/client'

export const runtime = 'nodejs'

export async function GET() {
  const result = await pool.query(`
    SELECT
      dl.id,
      dl.status,
      dl.proposed_rule_data,
      dl.source_url,
      dl.created_at,
      dl.verification_record_id,
      c.id        AS card_id,
      c.name      AS card_name,
      c.issuer    AS card_issuer,
      c.network   AS card_network,
      vr.evidence_status
    FROM data_leads dl
    INNER JOIN cards c ON c.id = dl.card_id
    LEFT JOIN verification_records vr ON vr.id = dl.verification_record_id
    WHERE dl.status = 'pending'
    ORDER BY dl.created_at
  `)

  const leads = result.rows.map((r) => ({
    id: r.id,
    status: r.status,
    proposedRuleData: r.proposed_rule_data,
    sourceUrl: r.source_url,
    createdAt: r.created_at,
    verificationRecordId: r.verification_record_id ?? null,
    evidenceStatus: r.evidence_status ?? null,
    card: { id: r.card_id, name: r.card_name, issuer: r.card_issuer, network: r.card_network },
  }))

  return NextResponse.json({ leads })
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)
  const { cardId, proposedRuleData, sourceUrl } = body ?? {}

  if (!cardId || !proposedRuleData || !sourceUrl) {
    return NextResponse.json(
      { error: 'cardId, proposedRuleData, and sourceUrl are required' },
      { status: 400 }
    )
  }

  const result = await pool.query(
    `INSERT INTO data_leads (card_id, proposed_rule_data, source_url)
     VALUES ($1, $2, $3)
     RETURNING id, card_id, proposed_rule_data, source_url, status, created_at`,
    [cardId, JSON.stringify(proposedRuleData), sourceUrl]
  )

  return NextResponse.json({ lead: result.rows[0] }, { status: 201 })
}
