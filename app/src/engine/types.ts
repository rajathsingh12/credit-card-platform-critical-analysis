export type MerchantCategory = string

export interface TransactionContext {
  transactionId: string
  amount: number // cents, non-negative integer
  merchantCategory: MerchantCategory
  merchantName: string
  transactionDate: string // YYYY-MM-DD
  /**
   * Prior periodic usage per rule, keyed by RuleVersion.id.
   * Omit or leave undefined for rules without a periodic cap.
   * When a rule has a periodic cap but its entry is missing here,
   * the engine yields an UnresolvedOutcome.
   */
  periodicUsage?: Record<string, PeriodicUsageEntry>
}

// ---------------------------------------------------------------------------
// Periodic cap
// ---------------------------------------------------------------------------

export type CapPeriod = 'monthly' | 'quarterly' | 'annual'

/**
 * Declares a periodic (month-to-date / quarter / annual) cap on a Reward Rule.
 * Points earned under this rule across the period are capped at `maxPoints`;
 * a transaction that would cross the cap earns only the remaining capacity.
 */
export interface PeriodicCapConfig {
  period: CapPeriod
  maxPoints: number // non-negative integer
  resetBasis: 'calendar' // resets on calendar boundaries (1st of month / quarter / year)
  timezone: string // IANA timezone for boundary computation, e.g. 'Asia/Kolkata'
}

/**
 * Prior cumulative usage for one rule within the current period,
 * supplied by the caller (zero-login flow: manually entered).
 */
export interface PeriodicUsageEntry {
  periodKey: string // e.g. '2024-06', '2024-Q2', '2024'
  pointsUsed: number // non-negative integer; points already earned this period
  trusted: boolean // false → engine yields UnresolvedOutcome
}

export interface DirectRewardRuleData {
  ruleType: 'direct'
  categories: MerchantCategory[] // empty = base rate (applies to all non-excluded categories)
  exclusions: MerchantCategory[]
  pointsPerDollar: number // e.g. 3 = 3 points per dollar spent
  capPoints: number | null // null = no per-transaction cap
  periodicCap?: PeriodicCapConfig // null/undefined = no periodic cap
}

export interface VariableRewardRuleData {
  ruleType: 'variable'
  categories: MerchantCategory[]
  exclusions: MerchantCategory[]
  pointsPerDollar: number
  capPoints: number | null
  periodicCap?: PeriodicCapConfig // null/undefined = no periodic cap
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
  ruleEffectiveFrom: string
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
  /** Present only when the rule has a periodicCap. */
  periodicCapTrace?: {
    periodKey: string
    maxPoints: number
    priorUsage: number
    remainingBefore: number
    pointsAfterPeriodicCap: number
    trusted: boolean
  }
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
  grossReturnCents: number | null // reward value earned = points × centsPerPoint; null for direct rewards
  annualFeeCents: number | null // full annual fee, shown as separate context; null if no fee
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
