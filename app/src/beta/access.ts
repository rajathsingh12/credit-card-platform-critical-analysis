export type AccessLevel = 'public' | 'invite' | 'admin'

/** Endpoints that must answer without a session: an uptime probe, and the
 *  redemption endpoint itself — it is how a visitor obtains a session. */
const PUBLIC_PATHS = new Set(['/api/health', '/api/invite/redeem'])

/** User-initiated paths that write to the database, and so are rate limited. */
const WRITE_PATHS = new Set(['/api/calculate', '/api/reports', '/api/telemetry'])

export function accessLevelFor(pathname: string): AccessLevel {
  if (PUBLIC_PATHS.has(pathname)) return 'public'
  if (pathname === '/api/admin' || pathname.startsWith('/api/admin/')) return 'admin'
  return 'invite'
}

export function isWritePath(pathname: string): boolean {
  return WRITE_PATHS.has(pathname)
}

/** `x-forwarded-proto` arrives as `https` (no colon); `nextUrl.protocol` as
 *  `https:`. Behind a proxy the header is the truthful one. */
export function isSecureRequest(
  forwardedProto: string | null,
  protocol: string | null | undefined
): boolean {
  const proto = forwardedProto?.split(',')[0].trim() || protocol
  return proto?.replace(/:$/, '') === 'https'
}
