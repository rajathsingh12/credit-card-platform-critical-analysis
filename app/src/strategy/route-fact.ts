import type { MerchantCategory, DirectRewardRuleData, RuleVersion } from '../engine/types'

/**
 * A route-fact Reward Rule describes one leg of a multi-step Payment Strategy
 * (e.g. a voucher purchase through a portal). It carries the voucher-purchase
 * leg's effective MCC so the existing engine exclusion logic can zero it out
 * where a card excludes that MCC.
 *
 * Stored as JSONB in rule_data alongside 'direct' and 'variable' rules.
 * Published/retracted through the same Rule Version + Verification Record +
 * Publication Gate path — no parallel store, no new approval flow.
 */
export interface RouteFactRuleData {
  ruleType: 'route-fact'
  /** The MCC/category the voucher purchase codes as (e.g. 'gift-card'). */
  effectiveMerchantCategory: MerchantCategory
  /** Card-level exclusions that apply to this leg (reuses the engine's exclusion check). */
  exclusions: MerchantCategory[]
  /** Earn treatment — points per major unit on the voucher purchase. */
  pointsPerDollar: number
  /** Per-transaction cap (null = uncapped). */
  capPoints: number | null
  /** Per-purchase fee in paise (positive = fee, negative = discount, 0 = none). Consumed by the composition layer (ticket 03). */
  voucherFeeCents: number
  /** Whether a periodic (monthly/quarterly) cap governs this route. Consumed by ticket 05/02. */
  capGoverned: boolean
}

// ---------------------------------------------------------------------------
// Type guard
// ---------------------------------------------------------------------------

export function isRouteFactRuleData(data: unknown): data is RouteFactRuleData {
  if (data === null || data === undefined || typeof data !== 'object') return false
  const d = data as Record<string, unknown>
  return (
    d.ruleType === 'route-fact' &&
    typeof d.effectiveMerchantCategory === 'string' &&
    Array.isArray(d.exclusions) &&
    typeof d.pointsPerDollar === 'number' &&
    (d.capPoints === null || typeof d.capPoints === 'number') &&
    typeof d.voucherFeeCents === 'number' &&
    typeof d.capGoverned === 'boolean'
  )
}

// ---------------------------------------------------------------------------
// Structural validator (pre-publish check, complements evidence validation)
// ---------------------------------------------------------------------------

type Validation = { ok: true } | { ok: false; error: string }

export function validateRouteFactRuleData(data: RouteFactRuleData): Validation {
  if (!data.effectiveMerchantCategory.trim()) {
    return { ok: false, error: 'effectiveMerchantCategory must not be empty' }
  }
  if (data.pointsPerDollar < 0) {
    return { ok: false, error: 'pointsPerDollar must be non-negative' }
  }
  if (data.capPoints !== null && (!Number.isInteger(data.capPoints) || data.capPoints < 0)) {
    return { ok: false, error: 'capPoints must be a non-negative integer or null' }
  }
  return { ok: true }
}

// ---------------------------------------------------------------------------
// Engine projection — compose above the engine, don't modify it
// ---------------------------------------------------------------------------

/**
 * Projects a route-fact into a RuleVersion the existing engine can evaluate.
 * The effective MCC becomes the single `categories` entry so the engine's
 * scope-check and exclusion-check run unchanged: if the card excludes that MCC
 * the leg earns zero.
 *
 * voucherFeeCents and capGoverned are metadata for the composition layer
 * (ticket 03) and are NOT projected.
 */
export function routeFactToEngineRule(
  data: RouteFactRuleData,
  envelope: { id: string; cardId: string; effectiveFrom: string; effectiveTo: string | null }
): RuleVersion {
  const ruleData: DirectRewardRuleData = {
    ruleType: 'direct',
    categories: [data.effectiveMerchantCategory],
    exclusions: data.exclusions,
    pointsPerDollar: data.pointsPerDollar,
    capPoints: data.capPoints,
  }
  return {
    id: envelope.id,
    cardId: envelope.cardId,
    effectiveFrom: envelope.effectiveFrom,
    effectiveTo: envelope.effectiveTo,
    ruleData,
  }
}
