#!/usr/bin/env tsx
/**
 * Seeds the curated Payment Strategy routes the same way the Verified Card Set is seeded:
 *
 *   npm run seed:strategies             prepares sources, verification records, and pending Data Leads
 *   npm run seed:strategies -- --approve  walks the publishable leads through the Publication Gate
 *
 * A lead whose evidence is only secondary or community-reported fails the gate and stays
 * pending. Nothing here is written straight into rule_versions.
 */

import { Pool, type PoolClient } from 'pg'
import { validateEvidence } from '../src/catalog/evidence'
import { publishLead } from '../src/admin/publish'
import { withTransaction } from '../src/db/transaction'
import { validateRouteFactRuleData } from '../src/strategy/route-fact'
import { ALL_STRATEGY_ROUTES, STRATEGY_VERIFIED_AT, type RouteSeed } from '../src/strategy/strategy-seed'

const approve = process.argv.includes('--approve')

async function cardIdFor(client: PoolClient, route: RouteSeed): Promise<string> {
  const res = await client.query(
    `SELECT id FROM cards WHERE issuer = $1 AND name = $2`,
    [route.card.issuer, route.card.name]
  )
  if (!res.rows[0]) {
    throw new Error(`${route.id}: no card for ${route.card.issuer} ${route.card.name} — seed the Verified Card Set first`)
  }
  return res.rows[0].id as string
}

async function sourceIdFor(client: PoolClient, route: RouteSeed): Promise<string> {
  const existing = await client.query(`SELECT id FROM sources WHERE url = $1 LIMIT 1`, [route.sourceUrl])
  if (existing.rows[0]) return existing.rows[0].id as string

  const res = await client.query(
    `INSERT INTO sources (name, url) VALUES ($1, $2) RETURNING id`,
    [route.sourceName, route.sourceUrl]
  )
  return res.rows[0].id as string
}

async function verificationIdFor(client: PoolClient, route: RouteSeed, sourceId: string): Promise<string> {
  const existing = await client.query(
    `SELECT id FROM verification_records WHERE source_id = $1 AND evidence_status = $2 LIMIT 1`,
    [sourceId, route.evidenceStatus]
  )
  if (existing.rows[0]) return existing.rows[0].id as string

  const res = await client.query(
    `INSERT INTO verification_records (source_id, evidence_status, verified_at, notes)
     VALUES ($1, $2, $3, $4) RETURNING id`,
    [sourceId, route.evidenceStatus, `${route.sourceDate}T00:00:00Z`, `${route.sourceName}; checked ${STRATEGY_VERIFIED_AT}`]
  )
  return res.rows[0].id as string
}

async function prepare(pool: Pool) {
  for (const route of ALL_STRATEGY_ROUTES) {
    const evidence = validateEvidence({ issuer: route.card.issuer, evidenceStatus: route.evidenceStatus, sourceUrl: route.sourceUrl })
    if (!evidence.ok) throw new Error(`${route.id}: ${evidence.error}`)

    const shape = validateRouteFactRuleData(route.ruleData)
    if (!shape.ok) throw new Error(`${route.id}: ${shape.error}`)
  }

  let created = 0
  let existing = 0

  await withTransaction(pool, async (client) => {
    for (const route of ALL_STRATEGY_ROUTES) {
      const cardId = await cardIdFor(client, route)
      const already = await client.query(
        `SELECT id FROM data_leads WHERE card_id = $1 AND source_url = $2 LIMIT 1`,
        [cardId, route.sourceUrl]
      )
      if (already.rows[0]) {
        existing += 1
        continue
      }

      const sourceId = await sourceIdFor(client, route)
      const verificationId = await verificationIdFor(client, route, sourceId)
      await client.query(
        `INSERT INTO data_leads (card_id, proposed_rule_data, source_url, verification_record_id)
         VALUES ($1, $2, $3, $4)`,
        [cardId, JSON.stringify(route.ruleData), route.sourceUrl, verificationId]
      )
      created += 1
    }
  })

  console.log(`Prepared ${ALL_STRATEGY_ROUTES.length} route facts.`)
  console.log(`  Data Leads created: ${created} (already present: ${existing})`)
  console.log(`\nNothing is published yet. Run "npm run seed:strategies -- --approve".`)
}

async function approvePending(pool: Pool) {
  const pending = await pool.query(
    `SELECT dl.id, c.issuer, c.name
     FROM data_leads dl
     JOIN cards c ON c.id = dl.card_id
     WHERE dl.status = 'pending' AND dl.proposed_rule_data->>'ruleType' = 'route-fact'
     ORDER BY c.issuer, c.name`
  )

  const publishedRoutes: string[] = []
  const withheld: string[] = []

  for (const lead of pending.rows) {
    const label = `${lead.issuer} ${lead.name}`
    // A route fact on a card with no published rule would become that card's only
    // rule, so the card would surface as verified. Hold it until the card publishes.
    const published = await pool.query(
      `SELECT 1 FROM rule_versions rv
       JOIN cards c ON c.id = rv.card_id
       WHERE c.issuer = $1 AND c.name = $2 AND rv.effective_to IS NULL AND rv.retracted_at IS NULL
         AND rv.rule_data->>'ruleType' <> 'route-fact' LIMIT 1`,
      [lead.issuer, lead.name]
    )
    if (published.rowCount === 0) {
      withheld.push(`${label} — the card has no published rule yet`)
      continue
    }
    const result = await publishLead(pool, lead.id, STRATEGY_VERIFIED_AT)
    if (result.ok) publishedRoutes.push(label)
    else withheld.push(`${label} — ${result.error}`)
  }

  console.log(`Publication Gate processed ${pending.rowCount} route fact(s).`)
  console.log(`\nPublished (${publishedRoutes.length}):`)
  for (const p of publishedRoutes) console.log(`  ✓ ${p}`)
  console.log(`\nWithheld (${withheld.length}):`)
  for (const w of withheld) console.log(`  – ${w}`)
}

async function main() {
  const url = process.env.DATABASE_URL
  if (!url) {
    console.error('DATABASE_URL is not set')
    process.exit(1)
  }

  const pool = new Pool({ connectionString: url })
  try {
    if (approve) await approvePending(pool)
    else await prepare(pool)
  } finally {
    await pool.end()
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
