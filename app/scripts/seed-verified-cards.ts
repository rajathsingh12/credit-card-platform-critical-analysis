#!/usr/bin/env tsx
/**
 * Seeds the Verified Card Set in two steps, because a Data Lead is not platform knowledge
 * until a Data Steward approves it:
 *
 *   npm run seed             prepares cards, sources, verification records, and pending Data Leads
 *   npm run seed -- --approve  walks the pending Data Leads through the Publication Gate
 *
 * The approve step calls the same publishLead used by the admin approval route, so the seed
 * cannot publish anything a steward could not publish by hand.
 */

import { Pool, type PoolClient } from 'pg'
import {
  ALL_SEED_CARDS,
  SEED_VERIFIED_AT,
  SEED_EFFECTIVE_FROM,
  type SeedCard,
} from '../src/catalog/verified-card-set'
import { classifyFeeBand, validateEvidence } from '../src/catalog/evidence'
import { publishLead } from '../src/admin/publish'
import { withTransaction } from '../src/db/transaction'

const approve = process.argv.includes('--approve')

async function upsertCard(client: PoolClient, spec: SeedCard): Promise<string> {
  const res = await client.query(
    `INSERT INTO cards (name, issuer, network, reward_currency, annual_fee_cents)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (issuer, name) DO UPDATE
       SET network = EXCLUDED.network,
           reward_currency = EXCLUDED.reward_currency,
           annual_fee_cents = EXCLUDED.annual_fee_cents,
           updated_at = NOW()
     RETURNING id`,
    [spec.name, spec.issuer, spec.network, spec.rewardCurrency, spec.annualFeeCents]
  )
  return res.rows[0].id as string
}

async function upsertSource(client: PoolClient, spec: SeedCard): Promise<string> {
  const existing = await client.query(`SELECT id FROM sources WHERE url = $1 LIMIT 1`, [
    spec.sourceUrl,
  ])
  if (existing.rows[0]) return existing.rows[0].id as string

  const res = await client.query(
    `INSERT INTO sources (name, url) VALUES ($1, $2) RETURNING id`,
    [spec.sourceName, spec.sourceUrl]
  )
  return res.rows[0].id as string
}

async function upsertVerificationRecord(
  client: PoolClient,
  spec: SeedCard,
  sourceId: string
): Promise<string> {
  const existing = await client.query(
    `SELECT id FROM verification_records
     WHERE source_id = $1 AND evidence_status = $2
     LIMIT 1`,
    [sourceId, spec.evidenceStatus]
  )
  if (existing.rows[0]) return existing.rows[0].id as string

  const res = await client.query(
    `INSERT INTO verification_records (source_id, evidence_status, verified_at, notes)
     VALUES ($1, $2, $3, $4)
     RETURNING id`,
    [
      sourceId,
      spec.evidenceStatus,
      `${SEED_VERIFIED_AT}T00:00:00Z`,
      `${spec.sourceName}; checked ${SEED_VERIFIED_AT}`,
    ]
  )
  return res.rows[0].id as string
}

async function upsertLead(
  client: PoolClient,
  spec: SeedCard,
  cardId: string,
  verificationRecordId: string
): Promise<'created' | 'exists'> {
  const existing = await client.query(
    `SELECT id FROM data_leads WHERE card_id = $1 AND source_url = $2 LIMIT 1`,
    [cardId, spec.sourceUrl]
  )
  if (existing.rows[0]) return 'exists'

  await client.query(
    `INSERT INTO data_leads (card_id, proposed_rule_data, source_url, verification_record_id)
     VALUES ($1, $2, $3, $4)`,
    [cardId, JSON.stringify(spec.ruleData), spec.sourceUrl, verificationRecordId]
  )
  return 'created'
}

async function upsertRedemptionScenarios(
  client: PoolClient,
  spec: SeedCard,
  cardId: string
): Promise<number> {
  let inserted = 0
  for (const r of spec.redemptions) {
    const existing = await client.query(
      `SELECT id FROM redemption_scenarios WHERE card_id = $1 AND redemption_type = $2 LIMIT 1`,
      [cardId, r.redemptionType]
    )
    if (existing.rows[0]) continue

    await client.query(
      `INSERT INTO redemption_scenarios
         (card_id, name, description, redemption_type, applicable_categories,
          cents_per_point, effective_from, effective_to)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        cardId,
        r.name,
        r.description,
        r.redemptionType,
        JSON.stringify(r.applicableCategories),
        r.centsPerPoint,
        r.effectiveFrom,
        r.effectiveTo,
      ]
    )
    inserted += 1
  }
  return inserted
}

async function prepare(pool: Pool) {
  const rejected = ALL_SEED_CARDS.map(spec => ({
    spec,
    check: validateEvidence({
      issuer: spec.issuer,
      evidenceStatus: spec.evidenceStatus,
      sourceUrl: spec.sourceUrl,
    }),
  })).filter(r => !r.check.ok)

  if (rejected.length > 0) {
    for (const r of rejected) {
      console.error(
        `  ✗ ${r.spec.issuer} ${r.spec.name}: ${r.check.ok === false ? r.check.error : ''}`
      )
    }
    throw new Error(`${rejected.length} card(s) failed evidence validation; nothing was seeded`)
  }

  let leadsCreated = 0
  let leadsExisting = 0
  let scenarios = 0

  await withTransaction(pool, async (client) => {
    for (const spec of ALL_SEED_CARDS) {
      const cardId = await upsertCard(client, spec)
      const sourceId = await upsertSource(client, spec)
      const verificationRecordId = await upsertVerificationRecord(client, spec, sourceId)
      const lead = await upsertLead(client, spec, cardId, verificationRecordId)
      if (lead === 'created') {
        leadsCreated += 1
      } else {
        leadsExisting += 1
      }
      scenarios += await upsertRedemptionScenarios(client, spec, cardId)
    }
  })

  console.log(`Prepared ${ALL_SEED_CARDS.length} cards with provenance.`)
  console.log(`  Data Leads created: ${leadsCreated} (already present: ${leadsExisting})`)
  console.log(`  Redemption Scenarios created: ${scenarios}`)
  console.log(`\nNothing is published yet. Run "npm run seed -- --approve" to walk the`)
  console.log(`pending Data Leads through the Publication Gate, or approve them in the admin API.`)
}

async function approvePending(pool: Pool) {
  const pending = await pool.query(
    `SELECT dl.id, c.issuer, c.name
     FROM data_leads dl
     JOIN cards c ON c.id = dl.card_id
     WHERE dl.status = 'pending'
     ORDER BY c.issuer, c.name`
  )

  const published: string[] = []
  const withheld: string[] = []

  for (const lead of pending.rows) {
    const label = `${lead.issuer} ${lead.name}`
    const result = await publishLead(pool, lead.id, SEED_EFFECTIVE_FROM)
    if (result.ok) {
      published.push(label)
    } else {
      withheld.push(`${label} — ${result.error}`)
    }
  }

  console.log(`Publication Gate processed ${pending.rowCount} pending Data Lead(s).`)
  console.log(`\nPublished (${published.length}):`)
  for (const p of published) console.log(`  ✓ ${p}`)
  console.log(`\nWithheld (${withheld.length}):`)
  for (const w of withheld) console.log(`  – ${w}`)
}

async function report(pool: Pool) {
  const res = await pool.query(
    `SELECT c.issuer, c.name, c.reward_currency, c.annual_fee_cents, vr.evidence_status
     FROM rule_versions rv
     JOIN cards c ON c.id = rv.card_id
     JOIN verification_records vr ON vr.id = rv.verification_record_id
     WHERE rv.effective_to IS NULL`
  )

  const rows = res.rows as {
    issuer: string
    reward_currency: string
    annual_fee_cents: number | null
    evidence_status: string
  }[]

  const count = (values: string[]) =>
    Array.from(new Set(values))
      .sort()
      .map(v => `${v} (${values.filter(x => x === v).length})`)
      .join(', ')

  console.log(`\nVerified Card Set: ${rows.length} card(s) with a published Rule Version.`)
  console.log(`  Issuers: ${count(rows.map(r => r.issuer))}`)
  console.log(`  Reward currencies: ${count(rows.map(r => r.reward_currency))}`)
  console.log(`  Fee bands: ${count(rows.map(r => classifyFeeBand(r.annual_fee_cents)))}`)
  console.log(`  Evidence: ${count(rows.map(r => r.evidence_status))}`)
}

async function main() {
  const url = process.env.DATABASE_URL
  if (!url) {
    console.error('DATABASE_URL is not set')
    process.exit(1)
  }

  const pool = new Pool({ connectionString: url })
  try {
    if (approve) {
      await approvePending(pool)
      await report(pool)
    } else {
      await prepare(pool)
    }
  } finally {
    await pool.end()
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
