import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/db/client'
import { validateLeadForRejection } from '@/admin/gate'

export const runtime = 'nodejs'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await request.json().catch(() => null)
  const { reason } = body ?? {}

  const leadRes = await pool.query(
    `SELECT id, status FROM data_leads WHERE id = $1`,
    [id]
  )
  const lead = leadRes.rows[0]
  if (!lead) return NextResponse.json({ error: 'lead not found' }, { status: 404 })

  const validation = validateLeadForRejection(lead, reason)
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 422 })
  }

  await pool.query(
    `UPDATE data_leads
     SET status = 'rejected', rejection_reason = $1, updated_at = NOW()
     WHERE id = $2`,
    [reason.trim(), id]
  )

  return NextResponse.json({ id, status: 'rejected', rejectionReason: reason.trim() })
}
