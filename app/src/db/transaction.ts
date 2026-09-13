import type { Pool, PoolClient } from 'pg'

export async function withTransaction<T>(
  pool: Pool,
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const result = await fn(client)
    await client.query('COMMIT')
    return result
  } catch (err) {
    try {
      await client.query('ROLLBACK')
    } catch {
      // original error wins; pg-pool destroys a dead client on release()
    }
    throw err
  } finally {
    client.release()
  }
}
