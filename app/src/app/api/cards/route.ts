import { NextResponse } from 'next/server'
import { pool } from '@/db/client'

export const runtime = 'nodejs'

export async function GET() {
  const result = await pool.query(`
    SELECT DISTINCT c.id, c.name, c.issuer, c.network, c.reward_currency
    FROM cards c
    INNER JOIN rule_versions rv ON rv.card_id = c.id
    ORDER BY c.issuer, c.name
  `)

  const cards = result.rows.map(r => ({
    id: r.id,
    name: r.name,
    issuer: r.issuer,
    network: r.network,
    rewardCurrency: r.reward_currency,
  }))

  return NextResponse.json({ cards })
}
