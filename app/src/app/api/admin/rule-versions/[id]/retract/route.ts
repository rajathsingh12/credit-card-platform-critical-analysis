import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/db/client'
import { retractRuleVersion, type RetractionFailureCode } from '@/admin/retract'
import { logEvent } from '@/telemetry/events-db'

export const runtime = 'nodejs'

const STATUS_BY_CODE: Record<RetractionFailureCode, number> = {
  'not-found': 404,
  'already-retracted': 409,
  'invalid-reason': 400,
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await request.json().catch(() => null)
  const { reason } = body ?? {}

  const result = await retractRuleVersion(pool, id, reason)

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: STATUS_BY_CODE[result.code] })
  }

  void logEvent({ eventName: 'correction_retracted', payload: { ruleVersionId: id, cardId: result.cardId } }).catch(() => {})
  return NextResponse.json({
    correctionHistoryId: result.correctionHistoryId,
    retractedAt: result.retractedAt,
  })
}
