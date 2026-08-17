import { NextResponse } from 'next/server'
import { checkDb } from '@/db/health'

export const runtime = 'nodejs'

export async function GET() {
  const db = await checkDb()
  if (!db) {
    return NextResponse.json({ status: 'error', db: 'disconnected' }, { status: 503 })
  }
  return NextResponse.json({ status: 'ok', db: 'connected' })
}
