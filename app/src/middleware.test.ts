import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const checkInviteCode = vi.fn()
vi.mock('./beta/invite-db', () => ({ checkInviteCode: (code: string) => checkInviteCode(code) }))

import { middleware, config } from './middleware'

const LIVE_CODE = 'a'.repeat(24)

function get(path: string, opts: { cookie?: string; bearer?: string } = {}) {
  const headers: Record<string, string> = {}
  if (opts.cookie) headers.cookie = `beta_access=${opts.cookie}`
  if (opts.bearer) headers.authorization = `Bearer ${opts.bearer}`
  return new NextRequest(`http://localhost${path}`, { headers })
}

/** Middleware returns a redirect for pages and JSON for APIs. */
function status(res: Response): number {
  return res.status === 307 || res.status === 308 ? 302 : res.status
}

beforeEach(() => {
  checkInviteCode.mockReset()
  process.env.ADMIN_TOKEN = 'secret-token'
})

describe('middleware — the invite gate is the access boundary', () => {
  it.each([
    '/api/cards',
    '/api/correction-history',
    '/api/calculate',
    '/api/reports',
    '/api/telemetry',
    '/api/something-added-later',
  ])('refuses %s without a session', async (path) => {
    expect(status(await middleware(get(path)))).toBe(401)
  })

  it('refuses the admin shell page without a session', async () => {
    expect(status(await middleware(get('/admin')))).toBe(302)
  })

  it('leaves the health probe open for an uptime monitor', async () => {
    expect(status(await middleware(get('/api/health')))).toBe(200)
    expect(checkInviteCode).not.toHaveBeenCalled()
  })

  it('leaves invite redemption open — it is how you get a session', async () => {
    expect(status(await middleware(get('/api/invite/redeem')))).toBe(200)
  })

  it('admits a session whose code is still live', async () => {
    checkInviteCode.mockResolvedValue('valid')
    expect(status(await middleware(get('/api/cards', { cookie: LIVE_CODE })))).toBe(200)
  })

  it('evicts a session whose code was revoked, despite a valid-looking cookie', async () => {
    checkInviteCode.mockResolvedValue('revoked')
    expect(status(await middleware(get('/api/cards', { cookie: LIVE_CODE })))).toBe(401)
  })

  it('evicts a revoked session from the admin shell too', async () => {
    checkInviteCode.mockResolvedValue('revoked')
    expect(status(await middleware(get('/admin', { cookie: LIVE_CODE })))).toBe(302)
  })

  it('rejects a cookie carrying a code that was never issued', async () => {
    checkInviteCode.mockResolvedValue('not_found')
    expect(status(await middleware(get('/api/cards', { cookie: 'b'.repeat(24) })))).toBe(401)
  })

  it('answers 429 once a session exceeds the write limit', async () => {
    checkInviteCode.mockResolvedValue('valid')
    const code = 'c'.repeat(24)
    let last = 200
    for (let i = 0; i < 40; i++) {
      last = status(await middleware(get('/api/calculate', { cookie: code })))
    }
    expect(last).toBe(429)
  })

  it('still admits reads after the write limit is hit', async () => {
    checkInviteCode.mockResolvedValue('valid')
    const code = 'd'.repeat(24)
    for (let i = 0; i < 40; i++) await middleware(get('/api/calculate', { cookie: code }))
    expect(status(await middleware(get('/api/cards', { cookie: code })))).toBe(200)
  })

  it('keeps the admin API on the bearer gate rather than the invite gate', async () => {
    expect(status(await middleware(get('/api/admin/leads')))).toBe(401)
    expect(status(await middleware(get('/api/admin/leads', { bearer: 'secret-token' })))).toBe(200)
  })
})

describe('middleware matcher', () => {
  it('covers every API route and the admin subtree, not just one path each', () => {
    expect(config.matcher).toContain('/api/:path*')
    // `/admin` alone would leave a future `/admin/anything` silently public.
    expect(config.matcher).toContain('/admin/:path*')
  })

  it('gates the home page', () => {
    expect(config.matcher).toContain('/')
  })
})
