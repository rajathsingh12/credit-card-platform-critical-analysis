import { NextRequest, NextResponse } from 'next/server'
import { revokeInviteCode } from '@/beta/invite-db'

export const runtime = 'nodejs'

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params
  const revoked = await revokeInviteCode(code)
  if (!revoked) {
    return NextResponse.json({ error: 'Code not found or already revoked' }, { status: 404 })
  }
  return NextResponse.json({ ok: true })
}
