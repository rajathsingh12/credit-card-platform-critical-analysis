#!/usr/bin/env tsx
/**
 * Runs the golden dataset against the rows the seed actually wrote, rather than against the
 * declarative card set. This is what closes the "zero Critical Calculation Errors" criterion:
 * the pure test suite proves the data is right, this proves the database agrees.
 */

import { Pool } from 'pg'
import { calculate } from '../src/engine/calculate'
import type { TransactionContext, TransactionOutcome } from '../src/engine/types'
import { toEngineRuleVersion, toEngineScenario } from '../src/catalog/db-mapping'
import { VERIFIED_CARD_SET, WITHHELD_CARD_SET } from '../src/catalog/verified-card-set'
import { classifyFeeBand, isPublishable, type EvidenceStatus } from '../src/catalog/evidence'

const PROBE_CATEGORIES = ['dining', 'travel', 'grocery', 'online', 'entertainment']
const PROBE_AMOUNTS = [100_000, 2_500_000]
const TXN_DATE = '2026-08-18'

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
              c.issuer, c.name, c.reward_currency, c.annual_fee_cents, vr.evidence_status
       FROM rule_versions rv
       JOIN cards c ON c.id = rv.card_id
       JOIN verification_records vr ON vr.id = rv.verification_record_id
       WHERE rv.effective_to IS NULL`
    )
  ).rows

  const scenarioRows = (
    await pool.query(
      `SELECT rs.id, rs.card_id, rs.redemption_type, rs.applicable_categories,
              rs.cents_per_point, rs.effective_from, rs.effective_to, c.annual_fee_cents
       FROM redemption_scenarios rs
       JOIN cards c ON c.id = rs.card_id`
    )
  ).rows

  const withheldRows = (
    await pool.query(
      `SELECT c.issuer, c.name, count(rv.id)::int AS versions
       FROM cards c
       LEFT JOIN rule_versions rv ON rv.card_id = c.id
       JOIN data_leads dl ON dl.card_id = c.id AND dl.status = 'pending'
       GROUP BY c.issuer, c.name`
    )
  ).rows

  await pool.end()

  const scenariosByCard = new Map<string, ReturnType<typeof toEngineScenario>[]>()
  for (const row of scenarioRows) {
    const list = scenariosByCard.get(row.card_id) ?? []
    list.push(toEngineScenario(row))
    scenariosByCard.set(row.card_id, list)
  }

  check(
    ruleRows.length === VERIFIED_CARD_SET.length,
    `expected ${VERIFIED_CARD_SET.length} published cards, found ${ruleRows.length}`
  )
  check(
    withheldRows.length === WITHHELD_CARD_SET.length,
    `expected ${WITHHELD_CARD_SET.length} withheld cards, found ${withheldRows.length}`
  )
  for (const row of withheldRows) {
    check(row.versions === 0, `${row.issuer} ${row.name} was withheld but has a Rule Version`)
  }

  for (const row of ruleRows) {
    const label = `${row.issuer} ${row.name}`
    const spec = VERIFIED_CARD_SET.find(c => c.issuer === row.issuer && c.name === row.name)
    if (!spec) {
      errors.push(`${label} is published but is not in the Verified Card Set`)
      continue
    }

    check(
      isPublishable(row.evidence_status as EvidenceStatus),
      `${label} published with ${row.evidence_status} evidence`
    )
    check(
      row.evidence_status === spec.evidenceStatus,
      `${label} evidence is ${row.evidence_status}, expected ${spec.evidenceStatus}`
    )
    check(
      row.reward_currency === spec.rewardCurrency,
      `${label} reward currency is ${row.reward_currency}, expected ${spec.rewardCurrency}`
    )
    check(
      row.annual_fee_cents === spec.annualFeeCents,
      `${label} annual fee is ${row.annual_fee_cents}, expected ${spec.annualFeeCents}`
    )

    const rule = toEngineRuleVersion(row)
    check(rule.effectiveFrom <= TXN_DATE, `${label} rule is not effective on ${TXN_DATE}`)

    // jsonb does not preserve key order, so compare the fields rather than the serialisation.
    const stored = rule.ruleData
    check(stored.ruleType === spec.ruleData.ruleType, `${label} stored ruleType is ${stored.ruleType}`)
    check(
      stored.pointsPerDollar === spec.ruleData.pointsPerDollar,
      `${label} stored pointsPerDollar is ${stored.pointsPerDollar}, expected ${spec.ruleData.pointsPerDollar}`
    )
    check(
      stored.capPoints === spec.ruleData.capPoints,
      `${label} stored capPoints is ${stored.capPoints}, expected ${spec.ruleData.capPoints}`
    )
    check(
      stored.categories.join() === spec.ruleData.categories.join(),
      `${label} stored categories are [${stored.categories}], expected [${spec.ruleData.categories}]`
    )
    check(
      stored.exclusions.join() === spec.ruleData.exclusions.join(),
      `${label} stored exclusions are [${stored.exclusions}], expected [${spec.ruleData.exclusions}]`
    )

    const scenarios = scenariosByCard.get(row.card_id) ?? []
    check(
      scenarios.length === spec.redemptions.length,
      `${label} has ${scenarios.length} redemption scenarios, expected ${spec.redemptions.length}`
    )

    for (const merchantCategory of PROBE_CATEGORIES) {
      for (const amount of PROBE_AMOUNTS) {
        const context: TransactionContext = {
          transactionId: `${label}|${merchantCategory}|${amount}`,
          amount,
          merchantCategory,
          merchantName: 'Verification Probe',
          transactionDate: TXN_DATE,
        }
        const probe = `${label} @ ${merchantCategory} ${amount}`
        const result = calculate(context, [rule], scenarios)

        if (!result.resolved) {
          errors.push(`${probe} produced an Unresolved Outcome: ${result.reason}`)
          continue
        }

        const outcome = result as TransactionOutcome
        check(outcome.ruleApplied !== null, `${probe} applied no rule`)
        check(
          Number.isInteger(outcome.rewardsEarned) && outcome.rewardsEarned >= 0,
          `${probe} earned ${outcome.rewardsEarned}`
        )
        if (rule.ruleData.capPoints !== null) {
          check(
            outcome.rewardsEarned <= rule.ruleData.capPoints,
            `${probe} earned ${outcome.rewardsEarned} above its cap of ${rule.ruleData.capPoints}`
          )
        }
        if (rule.ruleData.ruleType === 'variable') {
          check(outcome.scenarioApplied !== null, `${probe} cited no Redemption Scenario`)
          const expectedFee =
            spec.annualFeeCents === null ? null : Math.round(spec.annualFeeCents / 12)
          check(
            outcome.annualFeeAmortizedCents === expectedFee,
            `${probe} amortized ${outcome.annualFeeAmortizedCents}, expected ${expectedFee}`
          )
          check(
            outcome.netReturnCents !== null && Number.isInteger(outcome.netReturnCents),
            `${probe} reported a non-integer Net Return`
          )
        }
      }
    }
  }

  const goldenCases: { issuer: string; name: string; context: Partial<TransactionContext>; rewards: number; net: number | null }[] = [
    { issuer: 'HDFC Bank', name: 'Millennia', context: { amount: 250_000, merchantCategory: 'dining' }, rewards: 2_500, net: null },
    { issuer: 'Axis Bank', name: 'ACE', context: { amount: 400_000, merchantCategory: 'grocery' }, rewards: 6_000, net: null },
    { issuer: 'HDFC Bank', name: 'MoneyBack+', context: { amount: 20_000_000, merchantCategory: 'online' }, rewards: 2_000, net: 45_833 },
    { issuer: 'American Express', name: 'Platinum Travel Credit Card', context: { amount: 5_000_000, merchantCategory: 'travel' }, rewards: 1_000, net: 0 },
    { issuer: 'American Express', name: 'Platinum Travel Credit Card', context: { amount: 5_000_000, merchantCategory: 'dining' }, rewards: 1_000, net: -25_000 },
  ]

  for (const gold of goldenCases) {
    const row = ruleRows.find(r => r.issuer === gold.issuer && r.name === gold.name)
    if (!row) {
      errors.push(`golden case card missing: ${gold.issuer} ${gold.name}`)
      continue
    }
    const result = calculate(
      {
        transactionId: 'golden',
        amount: 0,
        merchantCategory: 'dining',
        merchantName: 'Golden',
        transactionDate: TXN_DATE,
        ...gold.context,
      } as TransactionContext,
      [toEngineRuleVersion(row)],
      scenariosByCard.get(row.card_id) ?? []
    )
    const label = `${gold.issuer} ${gold.name} @ ${gold.context.merchantCategory}`
    if (!result.resolved) {
      errors.push(`${label} was unresolved`)
      continue
    }
    const outcome = result as TransactionOutcome
    check(
      outcome.rewardsEarned === gold.rewards,
      `${label} earned ${outcome.rewardsEarned}, expected ${gold.rewards}`
    )
    check(
      outcome.netReturnCents === gold.net,
      `${label} net return ${outcome.netReturnCents}, expected ${gold.net}`
    )
  }

  const bands = new Set(ruleRows.map(r => classifyFeeBand(r.annual_fee_cents)))
  const issuers = new Set(ruleRows.map(r => r.issuer))
  const currencies = new Set(ruleRows.map(r => r.reward_currency))
  check(issuers.size >= 5, `expected at least 5 issuers, found ${issuers.size}`)
  check(currencies.size >= 3, `expected at least 3 reward currencies, found ${currencies.size}`)
  check(bands.size >= 3, `expected all 3 fee bands, found ${bands.size}`)
  check(
    ruleRows.length >= 30 && ruleRows.length <= 40,
    `expected 30-40 published cards, found ${ruleRows.length}`
  )

  const probeCount = ruleRows.length * PROBE_CATEGORIES.length * PROBE_AMOUNTS.length
  console.log(`Verified ${ruleRows.length} published cards against ${probeCount} probes`)
  console.log(`  Issuers: ${issuers.size}, reward currencies: ${currencies.size}, fee bands: ${bands.size}`)
  console.log(`  Withheld cards with no Rule Version: ${withheldRows.length}`)
  console.log(`  Golden cases checked: ${goldenCases.length}`)

  if (errors.length > 0) {
    console.error(`\n${errors.length} Critical Calculation Error(s):`)
    for (const e of errors) console.error(`  ✗ ${e}`)
    process.exit(1)
  }
  console.log(`\nZero Critical Calculation Errors.`)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
