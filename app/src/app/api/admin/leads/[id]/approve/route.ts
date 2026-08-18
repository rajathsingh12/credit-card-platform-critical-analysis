import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/db/client'
import { publishLead, type PublishFailureCode } from '@/admin/publish'

export const runtime = 'nodejs'

const STATUS_BY_CODE: Record<PublishFailureCode, number> = {
  'invalid-effective-from': 400,
  'lead-not-found': 404,
  'lead-not-approvable': 422,
  'evidence-below-standard': 422,
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await request.json().catch(() => null)
  const { effectiveFrom } = body ?? {}

  const result = await publishLead(pool, id, effectiveFrom)
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: STATUS_BY_CODE[result.code] })
  }

  return NextResponse.json({ ruleVersion: result.ruleVersion })
}
