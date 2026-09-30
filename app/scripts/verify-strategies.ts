#!/usr/bin/env tsx
/**
 * Prices the seeded Payment Strategy routes against the rows in Postgres.
 * DB-touching, so it lives here and not in vitest. Run with DATABASE_URL exported.
 */

import { Pool } from 'pg'
import { toEngineScenario, toIsoDate } from '../src/catalog/db-mapping'
import { compose, type StrategyLeg } from '../src/strategy/compose'
import { isRouteFactRuleData, routeFactToEngineRule, type RouteFactRuleData } from '../src/strategy/route-fact'
import {
  CAPPED_ROUTES_WITHHELD,
  DATA_LEAD_ROUTES,
  PUBLISHABLE_ROUTES,
  WALLET_LOAD,
} from '../src/strategy/strategy-seed'
import type { EvidenceStatus } from '../src/catalog/evidence'
import type { TransactionContext } from '../src/engine/types'

const TXN_DATE = '2026-09-30'
const AMOUNT = 830_000 // ₹8,300 — the naive "83 × 5" spend

const errors: string[] = []
function check(condition: boolean, message: string) {
  if (!condition) errors.push(message)
}

async function main() {
  const url = process.env.DATABASE_URL
  if (!url) {
    console.error('DATABASE_URL is not set')
    process.exit(1)
  }
  const pool = new Pool({ connectionString: url })

  const ruleRows = (
    await pool.query(
      `SELECT rv.id, rv.card_id, rv.effective_from, rv.effective_to, rv.rule_data,
              c.issuer, c.name, vr.evidence_status, vr.verified_at, vr.notes, s.url AS source_url
       FROM rule_versions rv
       JOIN cards c ON c.id = rv.card_id
       JOIN verification_records vr ON vr.id = rv.verification_record_id
       JOIN sources s ON s.id = vr.source_id
       WHERE rv.effective_to IS NULL AND rv.rule_data->>'ruleType' = 'route-fact'`
    )
  ).rows

  const baseRows = (
    await pool.query(
      `SELECT rv.id, rv.card_id, rv.effective_from, rv.effective_to, rv.rule_data
       FROM rule_versions rv
       WHERE rv.effective_to IS NULL AND rv.rule_data->>'ruleType' = 'variable'
         AND rv.card_id = ANY($1)`,
      [ruleRows.map(r => r.card_id)]
    )
  ).rows

  const scenarioRows = (
    await pool.query(
      `SELECT rs.id, rs.card_id, rs.redemption_type, rs.applicable_categories,
              rs.cents_per_point, rs.effective_from, rs.effective_to, c.annual_fee_cents
       FROM redemption_scenarios rs
       JOIN cards c ON c.id = rs.card_id
       WHERE rs.card_id = ANY($1)`,
      [ruleRows.map(r => r.card_id)]
    )
  ).rows

  const leadRows = (
    await pool.query(
      `SELECT dl.status, dl.source_url, vr.evidence_status
       FROM data_leads dl
       JOIN verification_records vr ON vr.id = dl.verification_record_id
       WHERE dl.proposed_rule_data->>'ruleType' = 'route-fact'`
    )
  ).rows

  await pool.end()

  check(
    ruleRows.length === PUBLISHABLE_ROUTES.length,
    `expected ${PUBLISHABLE_ROUTES.length} published routes, found ${ruleRows.length}`
  )

  // A route fact must sit beside the card's base rule, not replace it.
  const baseByCard = new Map(baseRows.map(r => [r.card_id, r]))
  for (const row of ruleRows) {
    check(baseByCard.has(row.card_id), `${row.issuer} ${row.name} lost its base rule when the route published`)
  }

  for (const lead of DATA_LEAD_ROUTES) {
    const row = leadRows.find(r => r.source_url === lead.sourceUrl)
    check(row !== undefined, `${lead.id} was not seeded`)
    check(row?.status === 'pending', `${lead.id} is ${row?.status}, expected a pending Data Lead`)
    check(
      ruleRows.every(r => r.source_url !== lead.sourceUrl),
      `${lead.id} was published`
    )
  }

  const context: TransactionContext = {
    transactionId: 'naive-voucher',
    amount: AMOUNT,
    merchantCategory: 'dining',
    merchantName: 'Swiggy',
    transactionDate: TXN_DATE,
  }

  for (const spec of PUBLISHABLE_ROUTES) {
    const row = ruleRows.find(r => r.issuer === spec.card.issuer && r.name === spec.card.name)
    const label = `${spec.card.issuer} ${spec.card.name}`
    if (!row) {
      errors.push(`${label}: route not published`)
      continue
    }

    check(row.evidence_status === spec.evidenceStatus, `${label}: evidence is ${row.evidence_status}`)
    check(row.source_url === spec.sourceUrl, `${label}: source url not recorded`)
    check(
      new Date(row.verified_at).toISOString().slice(0, 10) === spec.sourceDate,
      `${label}: source date not recorded`
    )

    if (!isRouteFactRuleData(row.rule_data)) {
      errors.push(`${label}: stored rule is not a route fact`)
      continue
    }
    check(row.rule_data.capGoverned === false, `${label}: an uncapped exclusion was seeded as capped`)

    const scenarios = scenarioRows.filter(s => s.card_id === row.card_id).map(toEngineScenario)
    const purchase: StrategyLeg = {
      id: 'voucher-purchase',
      merchantCategory: WALLET_LOAD,
      rule: routeFactToEngineRule(row.rule_data, {
        id: row.id,
        cardId: row.card_id,
        effectiveFrom: toIsoDate(row.effective_from),
        effectiveTo: null,
      }),
      scenarios,
      voucherFeeCents: row.rule_data.voucherFeeCents,
      capGoverned: row.rule_data.capGoverned,
      evidenceStatus: row.evidence_status as EvidenceStatus,
    }
    // Paying the merchant with stored value earns nothing on top — the purchase leg is the whole route.
    const redemption: StrategyLeg = {
      id: 'merchant-redemption',
      merchantCategory: 'dining',
      rule: routeFactToEngineRule(
        { ...row.rule_data, effectiveMerchantCategory: 'dining', exclusions: [], pointsPerDollar: 0 },
        { id: 'no-earn', cardId: row.card_id, effectiveFrom: TXN_DATE, effectiveTo: null }
      ),
      scenarios,
      evidenceStatus: row.evidence_status as EvidenceStatus,
    }

    const [priced] = compose(context, [{ id: spec.id, kind: 'route', legs: [purchase, redemption] }])
    check(priced.resolved, `${label}: route did not resolve`)
    if (priced.resolved) {
      check(priced.rewardValueCents === 0, `${label}: naive voucher route gained ${priced.rewardValueCents}, expected 0`)
    }
  }

  // A capped route is not published. Presented on its own, before its cap is modelled, it prices as Unresolved.
  const seededIds = [...PUBLISHABLE_ROUTES, ...DATA_LEAD_ROUTES].map(r => r.id)
  for (const id of CAPPED_ROUTES_WITHHELD) {
    check(!seededIds.includes(id), `${id} was seeded though its cap is not modelled`)
  }
  const cappedFact: RouteFactRuleData = {
    ruleType: 'route-fact',
    effectiveMerchantCategory: 'gift-card',
    exclusions: [],
    pointsPerDollar: 5,
    capPoints: null,
    voucherFeeCents: 0,
    capGoverned: true,
  }
  const [capped] = compose(context, [{
    id: CAPPED_ROUTES_WITHHELD[0],
    kind: 'route',
    legs: [{
      id: 'voucher-purchase',
      merchantCategory: 'gift-card',
      rule: routeFactToEngineRule(cappedFact, { id: 'unmodelled-cap', cardId: 'none', effectiveFrom: TXN_DATE, effectiveTo: null }),
      scenarios: [],
      capGoverned: true,
      evidenceStatus: 'officially-documented',
    }],
  }])
  check(!capped.resolved, 'a capped route with no modelled cap resolved to a number')

  console.log(`Published routes: ${ruleRows.length}, Data Leads still pending: ${leadRows.filter(r => r.status === 'pending').length}`)
  if (errors.length > 0) {
    console.error(`\n${errors.length} seed check failure(s):`)
    for (const e of errors) console.error(`  ✗ ${e}`)
    process.exit(1)
  }
  console.log(`\nSeeded routes price as expected. The naive voucher route gains nothing.`)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
