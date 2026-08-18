import { NextResponse } from 'next/server'
import { listInviteCodes, createInviteCode } from '@/beta/invite-db'
import { generateInviteCode } from '@/beta/invite'

export const runtime = 'nodejs'

export async function GET() {
  const codes = await listInviteCodes()
  return NextResponse.json({ codes })
}

export async function POST() {
  const code = generateInviteCode()
  const row = await createInviteCode(code)
  return NextResponse.json({ code: row }, { status: 201 })
}
