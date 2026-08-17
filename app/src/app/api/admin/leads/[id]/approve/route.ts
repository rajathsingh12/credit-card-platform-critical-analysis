import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/db/client'
import { validateLeadForApproval } from '@/admin/gate'

export const runtime = 'nodejs'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await request.json().catch(() => null)
  const { effectiveFrom } = body ?? {}

  if (!effectiveFrom || !/^\d{4}-\d{2}-\d{2}$/.test(effectiveFrom)) {
    return NextResponse.json(
      { error: 'effectiveFrom is required and must be YYYY-MM-DD' },
      { status: 400 }
    )
  }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const leadRes = await client.query(
      `SELECT id, card_id, proposed_rule_data, verification_record_id, status
       FROM data_leads WHERE id = $1 FOR UPDATE`,
      [id]
    )
    const lead = leadRes.rows[0]
    if (!lead) {
      await client.query('ROLLBACK')
      return NextResponse.json({ error: 'lead not found' }, { status: 404 })
    }

    const validation = validateLeadForApproval(lead)
    if (!validation.ok) {
      await client.query('ROLLBACK')
      return NextResponse.json({ error: validation.error }, { status: 422 })
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
    const ruleVersion = rvRes.rows[0]

    await client.query(
      `UPDATE data_leads SET status = 'approved', updated_at = NOW() WHERE id = $1`,
      [id]
    )

    await client.query('COMMIT')
    return NextResponse.json({ ruleVersion })
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}
