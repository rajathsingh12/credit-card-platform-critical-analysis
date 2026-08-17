import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./client', () => ({
  pool: { query: vi.fn() },
}))

import { pool } from './client'
import { checkDb } from './health'

describe('checkDb', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns true when the database is reachable', async () => {
    vi.mocked(pool.query).mockResolvedValueOnce(undefined as any)
    expect(await checkDb()).toBe(true)
  })

  it('returns false when the connection fails', async () => {
    vi.mocked(pool.query).mockRejectedValueOnce(new Error('ECONNREFUSED'))
    expect(await checkDb()).toBe(false)
  })
})
