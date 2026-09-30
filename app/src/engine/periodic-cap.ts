import type { CapPeriod, PeriodicCapConfig, PeriodicUsageEntry } from './types'

/**
 * Compute the period key for a transaction date under a given cap period.
 * Uses calendar boundaries; timezone is carried for future DST-aware
 * boundary computation but current implementation uses date-string math
 * (sufficient for YYYY-MM-DD inputs in the zero-login flow).
 */
export function periodKey(transactionDate: string, config: PeriodicCapConfig): string {
  // transactionDate is YYYY-MM-DD
  const [year, month] = transactionDate.split('-').map(Number)

  switch (config.period) {
    case 'monthly':
      return `${year}-${String(month).padStart(2, '0')}`
    case 'quarterly': {
      const q = Math.ceil(month / 3)
      return `${year}-Q${q}`
    }
    case 'annual':
      return `${year}`
  }
}

export type PeriodicCapResult =
  | { status: 'applied'; pointsAfterPeriodicCap: number; periodKey: string; priorUsage: number; remaining: number; trusted: true }
  | { status: 'untrusted'; periodKey: string; priorUsage: number; remaining: number }
  | { status: 'missing-usage'; periodKey: string }

/**
 * Apply the periodic cap to points already capped per-transaction.
 *
 * Returns the adjusted points (only the remaining capacity under the
 * periodic cap), or a signal that usage data is missing/untrusted.
 */
export function applyPeriodicCap(
  pointsAfterTxnCap: number,
  config: PeriodicCapConfig,
  usage: PeriodicUsageEntry | undefined,
  txnPeriodKey: string
): PeriodicCapResult {
  if (usage === undefined) {
    return { status: 'missing-usage', periodKey: txnPeriodKey }
  }

  if (usage.periodKey !== txnPeriodKey) {
    // Usage entry is for a different period — treat as missing.
    return { status: 'missing-usage', periodKey: txnPeriodKey }
  }

  const remaining = Math.max(0, config.maxPoints - usage.pointsUsed)

  if (!usage.trusted) {
    return { status: 'untrusted', periodKey: txnPeriodKey, priorUsage: usage.pointsUsed, remaining }
  }

  return {
    status: 'applied',
    pointsAfterPeriodicCap: Math.min(pointsAfterTxnCap, remaining),
    periodKey: txnPeriodKey,
    priorUsage: usage.pointsUsed,
    remaining,
    trusted: true,
  }
}
