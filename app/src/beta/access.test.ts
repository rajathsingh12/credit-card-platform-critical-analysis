import { describe, it, expect } from 'vitest'
import { accessLevelFor, isWritePath, isSecureRequest } from './access'

describe('accessLevelFor', () => {
  it('keeps the health probe public so a monitor can poll it', () => {
    expect(accessLevelFor('/api/health')).toBe('public')
  })

  it('keeps invite redemption public — it is how you get a session', () => {
    expect(accessLevelFor('/api/invite/redeem')).toBe('public')
  })

  it('puts the data endpoints behind the invite gate', () => {
    expect(accessLevelFor('/api/cards')).toBe('invite')
    expect(accessLevelFor('/api/calculate')).toBe('invite')
    expect(accessLevelFor('/api/reports')).toBe('invite')
    expect(accessLevelFor('/api/telemetry')).toBe('invite')
    expect(accessLevelFor('/api/correction-history')).toBe('invite')
  })

  it('puts the home page and the admin shell behind the invite gate', () => {
    expect(accessLevelFor('/')).toBe('invite')
    expect(accessLevelFor('/admin')).toBe('invite')
  })

  it('keeps the admin API on the bearer gate, not the invite gate', () => {
    expect(accessLevelFor('/api/admin/leads')).toBe('admin')
    expect(accessLevelFor('/api/admin/invites/abc/revoke')).toBe('admin')
  })

  it('gates an unknown API route rather than assuming it is public', () => {
    expect(accessLevelFor('/api/something-new')).toBe('invite')
  })
})

describe('isWritePath', () => {
  it('rate limits the paths that touch the database on behalf of a user', () => {
    expect(isWritePath('/api/calculate')).toBe(true)
    expect(isWritePath('/api/reports')).toBe(true)
    expect(isWritePath('/api/telemetry')).toBe(true)
  })

  it('does not rate limit reads', () => {
    expect(isWritePath('/api/cards')).toBe(false)
    expect(isWritePath('/api/correction-history')).toBe(false)
    expect(isWritePath('/api/health')).toBe(false)
  })
})

describe('isSecureRequest', () => {
  it('is secure when a proxy reports https', () => {
    expect(isSecureRequest('https', 'http:')).toBe(true)
  })

  it('is secure on a direct https request', () => {
    expect(isSecureRequest(null, 'https:')).toBe(true)
  })

  it('is not secure over plain http, so local development still works', () => {
    expect(isSecureRequest('http', 'http:')).toBe(false)
    expect(isSecureRequest(null, 'http:')).toBe(false)
  })

  it('handles a comma-separated forwarded proto by taking the first hop', () => {
    expect(isSecureRequest('https,http', 'http:')).toBe(true)
  })
})
