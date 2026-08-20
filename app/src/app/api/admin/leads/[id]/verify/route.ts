import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/db/client'
import { validateEvidence, EVIDENCE_STATUSES, type EvidenceStatus } from '@/catalog/evidence'
import { isPendingLead } from '@/admin/gate'

export const runtime = 'nodejs'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await request.json().catch(() => null)
  const { evidenceStatus, notes } = body ?? {}

  if (!evidenceStatus || !EVIDENCE_STATUSES.includes(evidenceStatus as EvidenceStatus)) {
    return NextResponse.json(
      { error: `evidenceStatus must be one of: ${EVIDENCE_STATUSES.join(', ')}` },
      { status: 400 }
    )
  }
  const status = evidenceStatus as EvidenceStatus

  const leadRes = await pool.query(
    `SELECT dl.id, dl.source_url, dl.status, c.issuer AS issuer
     FROM data_leads dl
     JOIN cards c ON c.id = dl.card_id
     WHERE dl.id = $1`,
    [id]
  )
  const lead = leadRes.rows[0]
  if (!lead) return NextResponse.json({ error: 'lead not found' }, { status: 404 })
  if (!isPendingLead(lead)) {
    return NextResponse.json({ error: `lead is ${lead.status}, not pending` }, { status: 422 })
  }

  const evidence = validateEvidence({
    issuer: lead.issuer,
    evidenceStatus: status,
    sourceUrl: lead.source_url,
  })
  if (!evidence.ok) {
    return NextResponse.json({ error: evidence.error }, { status: 422 })
  }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const sourceRes = await client.query(
      `INSERT INTO sources (name, url) VALUES ($1, $2) RETURNING id`,
      [lead.source_url, lead.source_url]
    )
    const sourceId = sourceRes.rows[0].id

    const vrRes = await client.query(
      `INSERT INTO verification_records (source_id, evidence_status, verified_at, notes)
       VALUES ($1, $2, NOW(), $3)
       RETURNING id, evidence_status, verified_at`,
      [sourceId, evidenceStatus, notes ?? null]
    )
    const vr = vrRes.rows[0]

    await client.query(
      `UPDATE data_leads SET verification_record_id = $1, updated_at = NOW() WHERE id = $2`,
      [vr.id, id]
    )

    await client.query('COMMIT')
    return NextResponse.json({ verificationRecord: vr }, { status: 201 })
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}
