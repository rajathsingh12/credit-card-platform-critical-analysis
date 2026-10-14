import { NextRequest, NextResponse } from 'next/server'
import { checkAdminAuth } from './admin/auth'
import { BETA_COOKIE } from './beta/invite'
import { checkInviteCode } from './beta/invite-db'
import { accessLevelFor, isWritePath } from './beta/access'
import { takeWriteSlot } from './beta/rate-limit'

// The gate re-validates the cookie against the database, which needs Node, not Edge.
export const runtime = 'nodejs'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const level = accessLevelFor(pathname)

  if (level === 'admin') {
    if (!checkAdminAuth(request.headers.get('authorization'))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.next()
  }

  if (level === 'public') {
    return NextResponse.next()
  }

  const code = request.cookies.get(BETA_COOKIE)?.value
  // Presence is not enough: a revoked code must not survive on a stale cookie.
  const valid = code ? (await checkInviteCode(code)) === 'valid' : false

  if (!pathname.startsWith('/api/')) {
    // A page wants a destination, not a status code.
    if (!code) return NextResponse.redirect(new URL('/invite', request.url))
    if (!valid) return NextResponse.redirect(new URL('/invite?revoked=1', request.url))
    return NextResponse.next()
  }

  if (!code || !valid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (isWritePath(pathname) && !takeWriteSlot(code, Date.now())) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  return NextResponse.next()
}

export const config = {
  // `/admin/:path*` covers `/admin` itself as well as any page nested under it,
  // so a future `/admin/foo` is gated by default rather than silently public.
  matcher: ['/', '/admin/:path*', '/api/:path*'],
}
