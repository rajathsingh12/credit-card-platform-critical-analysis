import type { RuleVersion, RedemptionScenario, RewardRuleData } from '../engine/types'

export type RuleVersionRow = {
  id: string
  card_id: string
  effective_from: string | Date
  effective_to: string | Date | null
  rule_data: RewardRuleData
}

export type RedemptionScenarioRow = {
  id: string
  card_id: string
  redemption_type: string
  applicable_categories: string[]
  cents_per_point: string | number
  effective_from: string | Date
  effective_to: string | Date | null
  annual_fee_cents: number | null
}

/**
 * pg hands back a DATE as a Date at local midnight, so toISOString would report the previous
 * day anywhere east of UTC. Read the local calendar fields instead.
 */
export function toIsoDate(value: string | Date): string {
  if (typeof value === 'string') return value.slice(0, 10)
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function toEngineRuleVersion(row: RuleVersionRow): RuleVersion {
  return {
    id: row.id,
    cardId: row.card_id,
    effectiveFrom: toIsoDate(row.effective_from),
    effectiveTo: row.effective_to === null ? null : toIsoDate(row.effective_to),
    ruleData: row.rule_data,
  }
}

// pg hands back NUMERIC as a string to protect precision; the engine needs a number.
export function toEngineScenario(row: RedemptionScenarioRow): RedemptionScenario {
  const centsPerPoint = Number(row.cents_per_point)
  if (!Number.isFinite(centsPerPoint)) {
    throw new Error(`redemption scenario ${row.id} has a non-numeric cents_per_point`)
  }
  return {
    id: row.id,
    cardId: row.card_id,
    redemptionType: row.redemption_type,
    applicableCategories: row.applicable_categories,
    effectiveFrom: toIsoDate(row.effective_from),
    effectiveTo: row.effective_to === null ? null : toIsoDate(row.effective_to),
    centsPerPoint,
    annualFeeCents: row.annual_fee_cents,
  }
}
