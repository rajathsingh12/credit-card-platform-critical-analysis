import type {
  TransactionContext,
  RuleVersion,
  TransactionOutcome,
  TraceEntry,
  DirectRewardRuleData,
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

function evalRule(context: TransactionContext, rule: RuleVersion): EvalResult {
  const rd: DirectRewardRuleData = rule.ruleData
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
  rules: RuleVersion[]
): TransactionOutcome {
  const results = rules.map(rule => evalRule(context, rule))

  const matched = results.filter((r): r is MatchedResult => r.matched)

  const best = matched.reduce<MatchedResult | null>(
    (acc, cur) => acc === null || cur.pointsAfterCap > acc.pointsAfterCap ? cur : acc,
    null
  )

  const entries: TraceEntry[] = results.map(r => {
    const isApplied = best !== null && r.rule.id === best.rule.id
    return {
    ruleId: r.rule.id,
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

  return {
    transactionId: context.transactionId,
    rewardsEarned: best?.pointsAfterCap ?? 0,
    ruleApplied: best?.rule.id ?? null,
    trace: {
      transactionId: context.transactionId,
      entries,
    },
  }
}
