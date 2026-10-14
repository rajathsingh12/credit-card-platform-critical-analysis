import { describe, it, expect, vi, afterEach } from 'vitest'

// These tests never open a connection: `new Pool()` is lazy, and the
// DATABASE_URL here points nowhere. They assert construction, not connectivity,
// so vitest stays DB-free.
describe('db client', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it('caps the pool so instances cannot exhaust the provider connection limit', async () => {
    vi.stubEnv('DATABASE_URL', 'postgresql://user:pass@localhost:5432/db')
    vi.stubEnv('NEXT_PHASE', '')

    const { pool } = await import('./client')
    // pg's default is 10; unbounded per-instance pools are the hazard this caps.
    expect(pool.options.max).toBe(5)
    await pool.end()
  })

  it('keeps at least two slots, because a route queries the pool inside a transaction', async () => {
    vi.stubEnv('DATABASE_URL', 'postgresql://user:pass@localhost:5432/db')
    vi.stubEnv('NEXT_PHASE', '')

    const { pool } = await import('./client')
    // `POST /api/reports` fires pool.query (via logEvent) while withTransaction
    // holds a client. At max 1 that waits for a slot that never frees: measured
    // as 'timeout exceeded when trying to connect'. The cap is a real floor.
    expect(pool.options.max).toBeGreaterThan(1)
    await pool.end()
  })

  it('does not throw during the production build when DATABASE_URL is unset', async () => {
    // `next build` imports every route module, so a throw here fails the build.
    vi.stubEnv('DATABASE_URL', '')
    vi.stubEnv('NEXT_PHASE', 'phase-production-build')

    const mod = await import('./client')
    expect(mod.pool).toBeDefined()
    await mod.pool.end()
  })

  it('still throws outside the build when DATABASE_URL is unset', async () => {
    vi.stubEnv('DATABASE_URL', '')
    vi.stubEnv('NEXT_PHASE', '')

    await expect(import('./client')).rejects.toThrow('DATABASE_URL is not set')
  })
})
