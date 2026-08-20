import { NextRequest, NextResponse } from 'next/server'
import { BETA_COOKIE } from '@/beta/invite'
import { isValidEventName, CLIENT_EVENT_NAMES } from '@/telemetry/events'
import { logEvent } from '@/telemetry/events-db'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)
  const { eventName, payload } = body ?? {}

  if (!isValidEventName(eventName) || !CLIENT_EVENT_NAMES.has(eventName)) {
    return NextResponse.json({ error: 'invalid eventName' }, { status: 400 })
  }

  const sessionToken = request.cookies.get(BETA_COOKIE)?.value

  await logEvent({
    eventName,
    sessionToken,
    payload:
      typeof payload === 'object' && payload !== null && !Array.isArray(payload)
        ? (payload as Record<string, unknown>)
        : {},
  })

  return NextResponse.json({ ok: true }, { status: 201 })
}
