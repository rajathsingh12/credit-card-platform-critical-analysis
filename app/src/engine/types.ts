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

export interface VariableRewardRuleData {
  ruleType: 'variable'
  categories: MerchantCategory[]
  exclusions: MerchantCategory[]
  pointsPerDollar: number
  capPoints: number | null
}

export type RewardRuleData = DirectRewardRuleData | VariableRewardRuleData

export interface RedemptionScenario {
  id: string
  cardId: string
  redemptionType: string // e.g. 'travel', 'cash-back', 'gift-card'
  applicableCategories: MerchantCategory[] // empty = applies to all categories
  effectiveFrom: string // YYYY-MM-DD
  effectiveTo: string | null // null = currently active
  centsPerPoint: number // cash value of one point in cents (may be fractional)
  annualFeeCents: number | null // annual fee in cents; null = no fee
}

export interface RuleVersion {
  id: string
  cardId: string
  effectiveFrom: string // YYYY-MM-DD
  effectiveTo: string | null // null = currently active
  ruleData: RewardRuleData
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
  resolved: true
  transactionId: string
  rewardsEarned: number // integer points; 0 if no rule matched
  ruleApplied: string | null // RuleVersion.id or null
  scenarioApplied: string | null // RedemptionScenario.id or null
  netReturnCents: number | null // points × centsPerPoint; null for direct rewards
  annualFeeAmortizedCents: number | null // annualFeeCents / 12; null if no fee
  trace: CalculationTrace
}

// Returned when a variable rule matched but no Redemption Scenario covers the transaction.
export interface UnresolvedOutcome {
  resolved: false
  transactionId: string
  reason: string
  rewardsEarned: number // points earned (rule matched); cash value unknown
  ruleApplied: string
  trace: CalculationTrace
}

export type CalcResult = TransactionOutcome | UnresolvedOutcome
