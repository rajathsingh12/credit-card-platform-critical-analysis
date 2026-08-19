import type {
  TransactionContext,
  RuleVersion,
  CalcResult,
  TransactionOutcome,
  UnresolvedOutcome,
  TraceEntry,
  RedemptionScenario,
} from './types'

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

  const entries: TraceEntry[] = results.map(r => {
    const isApplied = best !== null && r.rule.id === best.rule.id
    if (isApplied && selection !== null && selection.poolSize > 1) {
      r.assumptions.push(
        `selected scenario ${selection.scenario.id}: highest centsPerPoint (${selection.scenario.centsPerPoint}) among ${selection.poolSize} covering scenarios`
      )
    }
    return {
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
  })

  const trace = { transactionId: context.transactionId, entries }

  if (best !== null && best.rule.ruleData.ruleType === 'variable') {
    if (selection === null) {
      return {
        resolved: false,
        transactionId: context.transactionId,
        reason: 'no Redemption Scenario covers this transaction',
        rewardsEarned: best.pointsAfterCap,
        ruleApplied: best.rule.id,
        trace,
      } satisfies UnresolvedOutcome
    }
    const { scenario } = selection
    const grossReturn = Math.round(best.pointsAfterCap * scenario.centsPerPoint)
    const annualFeeAmortizedCents =
      scenario.annualFeeCents !== null ? Math.round(scenario.annualFeeCents / 12) : null
    return {
      resolved: true,
      transactionId: context.transactionId,
      rewardsEarned: best.pointsAfterCap,
      ruleApplied: best.rule.id,
      scenarioApplied: scenario.id,
      netReturnCents: annualFeeAmortizedCents !== null ? grossReturn - annualFeeAmortizedCents : grossReturn,
      annualFeeAmortizedCents,
      trace,
    } satisfies TransactionOutcome
  }

  return {
    resolved: true,
    transactionId: context.transactionId,
    rewardsEarned: best?.pointsAfterCap ?? 0,
    ruleApplied: best?.rule.id ?? null,
    scenarioApplied: null,
    netReturnCents: null,
    annualFeeAmortizedCents: null,
    trace,
  } satisfies TransactionOutcome
}
