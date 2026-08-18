import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/db/client'
import { retractRuleVersion } from '@/admin/retract'
import { logEvent } from '@/telemetry/events-db'

export const runtime = 'nodejs'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await request.json().catch(() => null)
  const { reason } = body ?? {}

  const result = await retractRuleVersion(pool, id, reason)

  if (!result.ok) {
    const status = result.code === 'not-found' ? 404 : result.code === 'already-retracted' ? 409 : 400
    return NextResponse.json({ error: result.error }, { status })
  }

  void logEvent({ eventName: 'correction_retracted', payload: { ruleVersionId: id, cardId: result.cardId } }).catch(() => {})
  return NextResponse.json({
    correctionHistoryId: result.correctionHistoryId,
    retractedAt: result.retractedAt,
  })
}
