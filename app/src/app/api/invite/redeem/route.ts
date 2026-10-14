import { NextRequest, NextResponse } from 'next/server'
import { checkInviteCode } from '@/beta/invite-db'
import { isValidCodeFormat, BETA_COOKIE } from '@/beta/invite'
import { isSecureRequest } from '@/beta/access'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)
  const { code } = body ?? {}

  if (!isValidCodeFormat(code)) {
    return NextResponse.json({ error: 'Invalid code format' }, { status: 400 })
  }

  const status = await checkInviteCode(code)
  if (status !== 'valid') {
    const msg = status === 'revoked' ? 'Invite code has been revoked' : 'Invalid invite code'
    return NextResponse.json({ error: msg }, { status: 401 })
  }

  const response = NextResponse.json({ ok: true })
  response.cookies.set(BETA_COOKIE, code, {
    httpOnly: true,
    sameSite: 'strict',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
    // Secure over HTTPS, but not over plain-HTTP local dev — a `secure` cookie
    // is dropped by the browser there and no session would ever be established.
    secure: isSecureRequest(
      request.headers.get('x-forwarded-proto'),
      request.nextUrl.protocol
    ),
  })
  return response
}
