import { NextRequest, NextResponse } from 'next/server'
import { checkAdminAuth } from './admin/auth'
import { BETA_COOKIE } from './beta/invite'

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (pathname.startsWith('/api/admin/')) {
    if (!checkAdminAuth(request.headers.get('authorization'))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  if (pathname === '/') {
    if (!request.cookies.get(BETA_COOKIE)) {
      return NextResponse.redirect(new URL('/invite', request.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/', '/api/admin/:path*'],
}
