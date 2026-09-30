import type {
  TransactionContext,
  RuleVersion,
  CalcResult,
  TransactionOutcome,
  UnresolvedOutcome,
  TraceEntry,
  RedemptionScenario,
} from './types'
import { periodKey, applyPeriodicCap } from './periodic-cap'

function isEffective(rule: RuleVersion, date: string): boolean {
  return rule.effectiveFrom <= date && (rule.effectiveTo === null || rule.effectiveTo >= date)
}

function computeRaw(amountCents: number, pointsPerDollar: number): number {
  return Math.floor((amountCents * pointsPerDollar) / 100)
}

type EvalResult = {
  rule: RuleVersion
  matched: boolean
  reason: string
  assumptions: string[]
  pointsBeforeCap: number | null
  pointsAfterCap: number | null
}

type MatchedResult = EvalResult & { matched: true; pointsBeforeCap: number; pointsAfterCap: number }

type ScenarioSelection = {
  scenario: RedemptionScenario
  poolSize: number
}

function selectScenario(
  context: TransactionContext,
  scenarios: RedemptionScenario[]
): ScenarioSelection | null {
  const effective = scenarios.filter(
    s =>
      s.effectiveFrom <= context.transactionDate &&
      (s.effectiveTo === null || s.effectiveTo >= context.transactionDate)
  )
  if (effective.length === 0) return null

  const specific = effective.filter(
    s =>
      s.applicableCategories.length > 0 &&
      s.applicableCategories.includes(context.merchantCategory)
  )
  const pool =
    specific.length > 0
      ? specific
      : effective.filter(s => s.applicableCategories.length === 0)
  if (pool.length === 0) return null

  const scenario = pool.reduce((best, cur) => (cur.centsPerPoint > best.centsPerPoint ? cur : best))
  return { scenario, poolSize: pool.length }
}

function evalRule(context: TransactionContext, rule: RuleVersion): EvalResult {
  const rd = rule.ruleData
  const assumptions: string[] = []

  if (!isEffective(rule, context.transactionDate)) {
    return {
      rule,
      matched: false,
      reason: `rule not effective on ${context.transactionDate} (effective ${rule.effectiveFrom} to ${rule.effectiveTo ?? 'present'})`,
      assumptions,
      pointsBeforeCap: null,
      pointsAfterCap: null,
    }
  }

  if (rd.exclusions.includes(context.merchantCategory)) {
    return {
      rule,
      matched: false,
      reason: `category "${context.merchantCategory}" is excluded`,
      assumptions,
      pointsBeforeCap: null,
      pointsAfterCap: null,
    }
  }

  const inScope =
    rd.categories.length === 0 || rd.categories.includes(context.merchantCategory)

  if (!inScope) {
    return {
      rule,
      matched: false,
      reason: `category "${context.merchantCategory}" not in [${rd.categories.join(', ')}]`,
      assumptions,
      pointsBeforeCap: null,
      pointsAfterCap: null,
    }
  }

  if (rd.categories.length === 0) {
    assumptions.push('base earn rate applies; rule covers all non-excluded categories')
  }

  const raw = computeRaw(context.amount, rd.pointsPerDollar)
  const capped = rd.capPoints !== null ? Math.min(raw, rd.capPoints) : raw

  if (rd.capPoints !== null && raw > rd.capPoints) {
    assumptions.push(`points capped at ${rd.capPoints} (uncapped value was ${raw})`)
  }

  return {
    rule,
    matched: true,
    reason: 'rule matches transaction',
    assumptions,
    pointsBeforeCap: raw,
    pointsAfterCap: capped,
  }
}

export function calculate(
  context: TransactionContext,
  rules: RuleVersion[],
  scenarios: RedemptionScenario[] = []
): CalcResult {
  const results = rules.map(rule => evalRule(context, rule))

  const matched = results.filter((r): r is MatchedResult => r.matched)

  const best = matched.reduce<MatchedResult | null>(
    (acc, cur) => acc === null || cur.pointsAfterCap > acc.pointsAfterCap ? cur : acc,
    null
  )

  const selection =
    best !== null && best.rule.ruleData.ruleType === 'variable'
      ? selectScenario(context, scenarios)
      : null

  // --- periodic cap ---
  // Applied to the winning rule only. If the rule declares a periodicCap,
  // we reduce its pointsAfterCap by whatever capacity remains in the period.
  // Missing or untrusted usage → UnresolvedOutcome (built after trace).
  let periodicCapTrace: TraceEntry['periodicCapTrace'] | undefined
  let periodicCapUnresolved: string | null = null
  let finalPoints = best?.pointsAfterCap ?? 0

  if (best !== null && best.rule.ruleData.periodicCap) {
    const config = best.rule.ruleData.periodicCap
    const pk = periodKey(context.transactionDate, config)
    const usage = context.periodicUsage?.[best.rule.id]
    const capResult = applyPeriodicCap(best.pointsAfterCap, config, usage, pk)

    switch (capResult.status) {
      case 'applied':
        finalPoints = capResult.pointsAfterPeriodicCap
        periodicCapTrace = {
          periodKey: pk,
          maxPoints: config.maxPoints,
          priorUsage: capResult.priorUsage,
          remainingBefore: capResult.remaining,
          pointsAfterPeriodicCap: capResult.pointsAfterPeriodicCap,
          trusted: true,
        }
        if (capResult.pointsAfterPeriodicCap < best.pointsAfterCap) {
          best.assumptions.push(
            `periodic ${config.period} cap: ${capResult.priorUsage}/${config.maxPoints} used, ` +
            `${capResult.remaining} remaining; earned capped from ${best.pointsAfterCap} to ${capResult.pointsAfterPeriodicCap}`
          )
        }
        break
      case 'untrusted':
        periodicCapTrace = {
          periodKey: pk,
          maxPoints: config.maxPoints,
          priorUsage: capResult.priorUsage,
          remainingBefore: capResult.remaining,
          pointsAfterPeriodicCap: finalPoints, // not adjusted — untrusted
          trusted: false,
        }
        periodicCapUnresolved = `periodic usage for rule ${best.rule.id} in period ${pk} is untrusted`
        break
      case 'missing-usage':
        periodicCapTrace = {
          periodKey: pk,
          maxPoints: config.maxPoints,
          priorUsage: 0,
          remainingBefore: config.maxPoints,
          pointsAfterPeriodicCap: finalPoints,
          trusted: false,
        }
        periodicCapUnresolved = `periodic usage for rule ${best.rule.id} in period ${pk} is missing`
        break
    }
  }

  const entries: TraceEntry[] = results.map(r => {
    const isApplied = best !== null && r.rule.id === best.rule.id
    if (isApplied && selection !== null && selection.poolSize > 1) {
      r.assumptions.push(
        `selected scenario ${selection.scenario.id}: highest centsPerPoint (${selection.scenario.centsPerPoint}) among ${selection.poolSize} covering scenarios`
      )
    }
    const entry: TraceEntry = {
      ruleId: r.rule.id,
      ruleEffectiveFrom: r.rule.effectiveFrom,
      applied: isApplied,
      reason: isApplied ? 'selected: highest earn rate among matching rules' : r.reason,
      inputs: {
        amount: context.amount,
        merchantCategory: context.merchantCategory,
        transactionDate: context.transactionDate,
        pointsPerDollar: r.rule.ruleData.pointsPerDollar,
        categories: r.rule.ruleData.categories,
        exclusions: r.rule.ruleData.exclusions,
        capPoints: r.rule.ruleData.capPoints,
      },
      assumptions: r.assumptions,
      pointsBeforeCap: r.pointsBeforeCap,
      pointsAfterCap: r.pointsAfterCap,
    }
    if (isApplied && periodicCapTrace) {
      entry.periodicCapTrace = periodicCapTrace
    }
    return entry
  })

  const trace = { transactionId: context.transactionId, entries }

  // Periodic cap unresolved takes precedence — we can't state a value.
  if (periodicCapUnresolved !== null && best !== null) {
    return {
      resolved: false,
      transactionId: context.transactionId,
      reason: periodicCapUnresolved,
      rewardsEarned: best.pointsAfterCap, // pre-periodic-cap points (best known)
      ruleApplied: best.rule.id,
      trace,
    } satisfies UnresolvedOutcome
  }

  if (best !== null && best.rule.ruleData.ruleType === 'variable') {
    if (selection === null) {
      return {
        resolved: false,
        transactionId: context.transactionId,
        reason: 'no Redemption Scenario covers this transaction',
        rewardsEarned: finalPoints,
        ruleApplied: best.rule.id,
        trace,
      } satisfies UnresolvedOutcome
    }
    const { scenario } = selection
    return {
      resolved: true,
      transactionId: context.transactionId,
      rewardsEarned: finalPoints,
      ruleApplied: best.rule.id,
      scenarioApplied: scenario.id,
      grossReturnCents: Math.round(finalPoints * scenario.centsPerPoint),
      annualFeeCents: scenario.annualFeeCents,
      trace,
    } satisfies TransactionOutcome
  }

  return {
    resolved: true,
    transactionId: context.transactionId,
    rewardsEarned: finalPoints,
    ruleApplied: best?.rule.id ?? null,
    scenarioApplied: null,
    grossReturnCents: null,
    annualFeeCents: null,
    trace,
  } satisfies TransactionOutcome
}
