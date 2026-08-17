import { NextRequest, NextResponse } from 'next/server'
import { checkAdminAuth } from './admin/auth'

export function middleware(request: NextRequest) {
  if (!checkAdminAuth(request.headers.get('authorization'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return NextResponse.next()
}

export const config = {
  matcher: '/api/admin/:path*',
}
