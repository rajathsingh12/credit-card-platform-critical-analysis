import { describe, it, expect, vi } from 'vitest'
import type { Pool, PoolClient } from 'pg'
import { withTransaction } from './transaction'

function makeFakePool() {
  const queries: string[] = []
  const release = vi.fn()
  const client = {
    query: vi.fn(async (sql: string) => {
      queries.push(sql)
      return { rows: [] }
    }),
    release,
  } as unknown as PoolClient
  const pool = { connect: async () => client } as unknown as Pool
  return { pool, queries, release }
}

describe('withTransaction', () => {
  it('issues BEGIN, then the callback queries, then COMMIT, in that order', async () => {
    const { pool, queries } = makeFakePool()

    await withTransaction(pool, async (client) => {
      await client.query('SELECT 1')
      await client.query('UPDATE rule_versions SET effective_to = NULL')
    })

    expect(queries).toEqual([
      'BEGIN',
      'SELECT 1',
      'UPDATE rule_versions SET effective_to = NULL',
      'COMMIT',
    ])
  })

  it('resolves to the callback return value', async () => {
    const { pool } = makeFakePool()
    const result = await withTransaction(pool, async () => ({ id: 'rv-1' }))
    expect(result).toEqual({ id: 'rv-1' })
  })

  it('rolls back without committing when the callback throws', async () => {
    const { pool, queries } = makeFakePool()

    await expect(
      withTransaction(pool, async (client) => {
        await client.query('SELECT 1')
        throw new Error('boom')
      })
    ).rejects.toThrow('boom')

    expect(queries).toEqual(['BEGIN', 'SELECT 1', 'ROLLBACK'])
    expect(queries).not.toContain('COMMIT')
  })

  it('rethrows the original error object unchanged', async () => {
    const { pool } = makeFakePool()
    const original = new Error('boom')

    await expect(
      withTransaction(pool, async () => {
        throw original
      })
    ).rejects.toBe(original)
  })

  it('releases the client exactly once on the success path', async () => {
    const { pool, release } = makeFakePool()
    await withTransaction(pool, async () => undefined)
    expect(release).toHaveBeenCalledTimes(1)
  })

  it('releases the client exactly once on the failure path', async () => {
    const { pool, release } = makeFakePool()
    await expect(
      withTransaction(pool, async () => {
        throw new Error('boom')
      })
    ).rejects.toThrow('boom')
    expect(release).toHaveBeenCalledTimes(1)
  })
})
