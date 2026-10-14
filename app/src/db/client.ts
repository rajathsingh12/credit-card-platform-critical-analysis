import { Pool } from 'pg'

const url = process.env.DATABASE_URL
// `next build` imports every route module to collect page data, so throwing
// here fails the build for a missing runtime secret. Defer it: without a URL
// the first query fails and the health probe reports `db: disconnected`.
const isBuild = process.env.NEXT_PHASE === 'phase-production-build'
if (!url && !isBuild) throw new Error('DATABASE_URL is not set')

// The provider's pooler multiplexes server-side, so a big client pool is
// pointless: each serverless instance needs only a few, and pg's default of 10
// multiplies across instances until the connection limit is gone. A bounded
// connection timeout fails a saturated pool fast instead of hanging.
// Keep max above 1: `POST /api/reports` fires a pool.query from inside a
// transaction that already holds a client, which would deadlock at max 1.
// ponytail: fixed cap, make it an env var if one instance ever needs more.
export const pool = new Pool({
  connectionString: url,
  max: 5,
  connectionTimeoutMillis: 10_000,
})
