import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { checkAdminAuth } from './auth'

describe('checkAdminAuth', () => {
  beforeEach(() => {
    vi.stubEnv('ADMIN_TOKEN', 'secret-token')
  })
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('returns true for matching Bearer token', () => {
    expect(checkAdminAuth('Bearer secret-token')).toBe(true)
  })

  it('returns true for Bearer token with extra spaces', () => {
    expect(checkAdminAuth('Bearer  secret-token')).toBe(true)
  })

  it('returns false for wrong token', () => {
    expect(checkAdminAuth('Bearer wrong')).toBe(false)
  })

  it('returns false when header is null', () => {
    expect(checkAdminAuth(null)).toBe(false)
  })

  it('returns false when header is undefined', () => {
    expect(checkAdminAuth(undefined)).toBe(false)
  })

  it('returns false when ADMIN_TOKEN is not set (fail-closed)', () => {
    vi.stubEnv('ADMIN_TOKEN', '')
    expect(checkAdminAuth('Bearer secret-token')).toBe(false)
  })
})
