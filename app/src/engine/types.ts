export type MerchantCategory = string

export interface TransactionContext {
  transactionId: string
  amount: number // cents, non-negative integer
  merchantCategory: MerchantCategory
  merchantName: string
  transactionDate: string // YYYY-MM-DD
}

export interface DirectRewardRuleData {
  ruleType: 'direct'
  categories: MerchantCategory[] // empty = base rate (applies to all non-excluded categories)
  exclusions: MerchantCategory[]
  pointsPerDollar: number // e.g. 3 = 3 points per dollar spent
  capPoints: number | null // null = no per-transaction cap
}

export interface RuleVersion {
  id: string
  cardId: string
  effectiveFrom: string // YYYY-MM-DD
  effectiveTo: string | null // null = currently active
  ruleData: DirectRewardRuleData
}

export interface TraceEntry {
  ruleId: string
  applied: boolean
  reason: string
  inputs: {
    amount: number
    merchantCategory: string
    transactionDate: string
    pointsPerDollar: number
    categories: string[]
    exclusions: string[]
    capPoints: number | null
  }
  assumptions: string[]
  pointsBeforeCap: number | null
  pointsAfterCap: number | null
}

export interface CalculationTrace {
  transactionId: string
  entries: TraceEntry[]
}

export interface TransactionOutcome {
  transactionId: string
  rewardsEarned: number // integer points; 0 if no rule matched
  ruleApplied: string | null // RuleVersion.id or null
  trace: CalculationTrace
}
