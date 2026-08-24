#!/usr/bin/env tsx
import { Pool } from 'pg'
import { isValidCodeFormat } from '../src/beta/invite'

async function main() {
  const url = process.env.DATABASE_URL
  if (!url) {
    console.error('DATABASE_URL is not set')
    process.exit(1)
  }

  const codes = (process.env.BETA_INVITE_CODES ?? '')
    .split(',')
    .map(c => c.trim())
    .filter(Boolean)

  if (codes.length === 0) {
    console.error('BETA_INVITE_CODES is not set')
    process.exit(1)
  }

  const malformed = codes.filter(c => !isValidCodeFormat(c))
  if (malformed.length > 0) {
    console.error(`Invite codes must be 24 lowercase hex characters: ${malformed.join(', ')}`)
    process.exit(1)
  }

  const pool = new Pool({ connectionString: url })
  try {
    for (const code of codes) {
      await pool.query(
        `INSERT INTO invite_codes (code) VALUES ($1)
         ON CONFLICT (code) DO UPDATE SET revoked_at = NULL`,
        [code]
      )
    }
    console.log(`Invite codes ready (${codes.length}): ${codes.join(', ')}`)
  } finally {
    await pool.end()
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
