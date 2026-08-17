import { readdir, readFile } from 'fs/promises'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { Pool } from 'pg'

const __dirname = dirname(fileURLToPath(import.meta.url))

async function main() {
  const url = process.env.DATABASE_URL
  if (!url) {
    console.error('DATABASE_URL is not set')
    process.exit(1)
  }

  const pool = new Pool({ connectionString: url })

  await pool.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      name TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ DEFAULT NOW()
    )
  `)

  const migrationsDir = join(__dirname, '..', 'migrations')
  const files = (await readdir(migrationsDir))
    .filter(f => f.endsWith('.sql'))
    .sort()

  for (const file of files) {
    const { rowCount } = await pool.query(
      'SELECT 1 FROM _migrations WHERE name = $1',
      [file]
    )
    if (rowCount && rowCount > 0) {
      console.log(`Skipped (already applied): ${file}`)
      continue
    }

    const sql = await readFile(join(migrationsDir, file), 'utf-8')
    await pool.query('BEGIN')
    try {
      await pool.query(sql)
      await pool.query('INSERT INTO _migrations (name) VALUES ($1)', [file])
      await pool.query('COMMIT')
      console.log(`Applied: ${file}`)
    } catch (err) {
      await pool.query('ROLLBACK')
      throw err
    }
  }

  await pool.end()
  console.log('Migrations complete.')
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
